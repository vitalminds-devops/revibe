"""Run from the repository root: python -m backend.test_main [--integration]"""
from io import BytesIO
import json
from pathlib import Path
import socket
import sys
import time
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import database, storage
from backend.database import sqlalchemy_url
from backend.inference import FIELDS, extract_fields, generate, parse_fields
from backend.main import app
from backend.models import Base

SAMPLE = Path(__file__).parent / "sample.png"


class ReportTests(unittest.TestCase):
    """API tests run the real ORM queries against an in-memory SQLite database."""

    def setUp(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(engine)  # tests only; real tables come from Prisma migrations
        sessions = sessionmaker(engine, expire_on_commit=False)

        def get_session():
            with sessions() as session:
                yield session

        app.dependency_overrides[database.get_session] = get_session
        self.addCleanup(app.dependency_overrides.clear)
        patcher = patch.multiple("backend.storage", put=MagicMock(), get=MagicMock(return_value=b"img"),
                                 url=MagicMock(side_effect=lambda key: f"https://r2/{key}"))
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client = TestClient(app)

    def folder(self, name="Team 5"):
        response = self.client.post("/folders", json={"name": name})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def upload(self, folder_id, data=None):
        data = data or SAMPLE.read_bytes()
        return self.client.post(f"/folders/{folder_id}/screenshots", files={"image": ("s.png", data, "image/png")})

    def test_invalid_uploads_are_not_stored(self):
        folder = self.folder()
        for mime in ("text/plain", "image/png"):
            response = self.client.post(f"/folders/{folder['id']}/screenshots",
                                        files={"image": ("bad.png", b"bad", mime)})
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.upload(folder["id"], b"x" * (10 * 1024 * 1024 + 1)).status_code, 413)
        self.assertEqual(self.upload(999).status_code, 404)
        storage.put.assert_not_called()
        self.assertEqual(self.client.get(f"/folders/{folder['id']}/screenshots").json(), [])

    def test_folders_create_rename_sort_and_reject_duplicates(self):
        for name in ("", "   ", "x" * 81):
            self.assertEqual(self.client.post("/folders", json={"name": name}).status_code, 422)
        team = self.folder(" Team 5 ")
        self.assertEqual(team["name"], "Team 5")
        self.assertEqual(self.client.post("/folders", json={"name": "team 5"}).status_code, 409)
        alpha = self.folder("alpha")
        self.assertEqual(self.client.patch(f"/folders/{alpha['id']}", json={"name": "TEAM 5"}).status_code, 409)
        renamed = self.client.patch(f"/folders/{alpha['id']}", json={"name": "Alpha site"}).json()
        self.assertEqual(renamed["name"], "Alpha site")
        self.assertEqual(self.client.patch("/folders/999", json={"name": "x"}).status_code, 404)
        by_name = [f["name"] for f in self.client.get("/folders?sort=name").json()]
        self.assertEqual(by_name, ["Alpha site", "Team 5"])
        self.assertEqual(self.client.get("/folders?sort=bogus").status_code, 422)

    def test_upload_counts_and_report_generation(self):
        folder = self.folder()
        shot = self.upload(folder["id"]).json()
        self.assertEqual((shot["source"], shot["report"], shot["image_url"][:11]), ("upload", None, "https://r2/"))
        self.assertTrue(shot["image_key"].startswith(f"folders/{folder['id']}/"))
        second = self.upload(folder["id"]).json()
        counts = self.client.get("/folders").json()[0]
        self.assertEqual((counts["screenshots"], counts["reports"], counts["pending"]), (2, 0, 2))
        with patch("backend.inference.generate", return_value={"fields": {"category": "Repair"}, "report": "Done"}):
            done = self.client.post(f"/screenshots/{shot['id']}/report").json()
        self.assertEqual((done["report"], done["fields"], done["error"]), ("Done", {"category": "Repair"}, None))
        with patch("backend.inference.generate", side_effect=HTTPException(400, "No readable text found in the image")):
            failed = self.client.post(f"/screenshots/{second['id']}/report").json()
        self.assertEqual((failed["report"], failed["error"]), (None, "No readable text found in the image"))
        counts = self.client.get("/folders").json()[0]
        self.assertEqual((counts["screenshots"], counts["reports"], counts["pending"]), (2, 1, 0))
        with patch("backend.inference.generate", side_effect=HTTPException(503, "Local inference failed")):
            self.assertEqual(self.client.post(f"/screenshots/{shot['id']}/report").status_code, 503)
        self.assertEqual(self.client.post("/screenshots/999/report").status_code, 404)

    def test_excel_export_is_named_after_folder_and_keeps_formulas_as_text(self):
        folder = self.folder("Team 5 / Nov")
        shot = self.upload(folder["id"]).json()
        self.upload(folder["id"])  # no report yet: left out of the export
        with patch("backend.inference.generate", return_value={"fields": {"category": "=HYPERLINK(1)"}, "report": "Done"}):
            self.client.post(f"/screenshots/{shot['id']}/report")
        response = self.client.get(f"/folders/{folder['id']}/export.xlsx")
        self.assertIn('filename="Team 5 _ Nov.xlsx"', response.headers["content-disposition"])
        sheet = load_workbook(BytesIO(response.content)).active
        self.assertEqual(sheet.max_row, 2)
        category = sheet.cell(2, 3 + FIELDS.index("category") + 1)
        self.assertEqual((category.value, category.data_type), ("=HYPERLINK(1)", "s"))
        self.assertEqual(sheet.cell(2, sheet.max_column).value, "Done")

    def test_database_url_conversion(self):
        self.assertEqual(sqlalchemy_url("postgresql://u:p@h:5432/db?schema=public&sslmode=require"),
                         "postgresql+psycopg://u:p@h:5432/db?sslmode=require")

    def test_local_ocr_preserves_fields(self):
        with patch("backend.inference.local_models") as models:
            models.return_value = (MagicMock(), None, None)
            models.return_value[0].readtext.return_value = ["JO Number: JO-20261031-0005"]
            fields = extract_fields(SAMPLE.read_bytes())
            self.assertEqual(set(fields), set(FIELDS))
            self.assertEqual(fields["jo_number"], "JO-20261031-0005")
            self.assertEqual(fields["rfo"], "")

    def test_empty_or_excessive_ocr(self):
        with patch("backend.inference.local_models") as models:
            models.return_value = (MagicMock(), None, None)
            for lines in ([], ["x" * 12001]):
                models.return_value[0].readtext.return_value = lines
                with self.assertRaises(HTTPException) as error:
                    extract_fields(SAMPLE.read_bytes())
                self.assertEqual(error.exception.status_code, 400)

    def test_report_layout_and_multiline_values(self):
        fields = parse_fields(
            "Luke Nhel Marino Accomplishment Report November 10 2026\n"
            "Team5 Luke/J Soriano/A Gupo CDZ 6476\n"
            "Task 1 Category: Repair Service Type: NAP\n"
            "JO Number: JO-20261031-0005 Date: Oct 31, 2026\n"
            "PMS Ticket: Trouble Ticket: Channel: Viber GC\n"
            "Nap: Code: BUM001 LP23 NP7\n"
            "Remarks: Repair needed\nBUM001 LP23 NP7 - NAP Split\n"
            "Arrival 8:00 AM Departure 8:20 AM Done Rectification 12:00 PM\n"
            "RFO: Kink fiber\nat NP Box\nA/T: Resplice fiber"
        )
        for key, value in {
            "technician": "Luke Nhel Marino", "report_date": "November 10 2026",
            "team": "5", "members": "Luke/J Soriano/A Gupo", "cdz": "6476", "task_no": "1",
            "category": "Repair", "service_type": "NAP", "jo_number": "JO-20261031-0005",
            "jo_date": "Oct 31, 2026", "pms_ticket": "", "trouble_ticket": "",
            "channel": "Viber GC", "remarks": "Repair needed", "work_done": "BUM001 LP23 NP7 - NAP Split",
            "nap_code": "BUM001 LP23 NP7",
            "arrival": "8:00 AM", "departure": "8:20 AM", "done_rectification": "12:00 PM",
            "rfo": "Kink fiber\nat NP Box", "action_taken": "Resplice fiber",
        }.items():
            self.assertEqual(fields[key], value, key)

    def test_generate_and_model_failure(self):
        with patch("backend.inference.extract_fields", return_value={"jo_number": "JO-1"}), \
                patch("backend.inference.chat") as chat:
            chat.return_value = "Job JO-1 completed."
            self.assertEqual(generate(b"image")["report"], "Job JO-1 completed.")
            chat.side_effect = OSError("missing model")
            with self.assertRaises(HTTPException) as error:
                generate(b"image")
            self.assertEqual(error.exception.status_code, 503)


def integration_check():
    started = time.monotonic()
    # Block outgoing connections to prove the downloaded weights work offline.
    with patch.object(socket.socket, "connect", side_effect=AssertionError("Network access forbidden")):
        body = generate(SAMPLE.read_bytes())
    assert "20261031-0005" in body["fields"]["jo_number"], body["fields"]
    assert body["fields"]["task_no"] == "1", body["fields"]
    assert body["fields"]["done_rectification"] == "12.00 PM", body["fields"]
    assert "NAP" in body["report"], body["report"]
    assert set(body["fields"]) == set(FIELDS), body["fields"]
    print(json.dumps(body, indent=2, ensure_ascii=False))
    print(f"Offline integration passed in {time.monotonic() - started:.1f}s")


if __name__ == "__main__":
    if "--integration" in sys.argv:
        integration_check()
    else:
        unittest.main()

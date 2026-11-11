"""Screenshot upload (stored in R2) and per-screenshot report generation."""
from io import BytesIO
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend import database, inference, storage
from backend.models import Folder, Screenshot
from backend.schemas import ShotOut

router = APIRouter(tags=["screenshots"])
SessionDep = Annotated[Session, Depends(database.get_session)]
MAX_BYTES = 10 * 1024 * 1024


def to_out(shot: Screenshot) -> ShotOut:
    return ShotOut(id=shot.id, folder_id=shot.folder_id, image_key=shot.image_key,
                   image_url=storage.url(shot.image_key), source=shot.source, created_at=shot.created_at,
                   fields=shot.fields, report=shot.report, error=shot.error)


def require_folder(session: Session, folder_id: int):
    if session.get(Folder, folder_id) is None:
        raise HTTPException(404, "Folder not found")


@router.get("/folders/{folder_id}/screenshots", response_model=list[ShotOut])
def list_screenshots(folder_id: int, session: SessionDep):
    require_folder(session, folder_id)
    shots = session.scalars(
        select(Screenshot).where(Screenshot.folder_id == folder_id).order_by(Screenshot.created_at.desc())
    )
    return [to_out(shot) for shot in shots]


@router.post("/folders/{folder_id}/screenshots", status_code=201, response_model=ShotOut)
def add_screenshot(folder_id: int, session: SessionDep, image: UploadFile = File(...),
                   source: str = Form("upload")):
    if not (image.content_type or "").startswith("image/"):
        raise HTTPException(400, "upload an image file")
    if source not in ("upload", "screen"):
        raise HTTPException(400, "unknown source")
    image_bytes = image.file.read(MAX_BYTES + 1)
    if len(image_bytes) > MAX_BYTES:
        raise HTTPException(413, "Image must be at most 10 MB")
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            img.verify()
            ext = (img.format or "png").lower()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(400, "Upload a valid image file") from exc
    require_folder(session, folder_id)
    key = f"folders/{folder_id}/{uuid4().hex}.{ext}"
    storage.put(key, image_bytes, f"image/{ext}")
    shot = Screenshot(folder_id=folder_id, image_key=key, source=source)
    session.add(shot)
    session.commit()
    session.refresh(shot)  # load created_at set by the database
    return to_out(shot)


@router.post("/screenshots/{shot_id}/report", response_model=ShotOut)
def generate_report(shot_id: int, session: SessionDep):
    shot = session.get(Screenshot, shot_id)
    if not shot:
        raise HTTPException(404, "Screenshot not found")
    session.commit()  # release the connection during the minute-long inference
    try:
        result, error = inference.generate(storage.get(shot.image_key)), None
    except HTTPException as exc:
        if exc.status_code != 400:
            raise  # model/server failures stay pending so they can be retried
        result, error = {"fields": None, "report": None}, exc.detail
    shot.fields, shot.report, shot.error = result["fields"], result["report"], error
    session.add(shot)
    session.commit()
    return to_out(shot)

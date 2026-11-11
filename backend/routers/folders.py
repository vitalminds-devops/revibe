"""Named folders that group screenshots, plus per-folder Excel export."""
from io import BytesIO
import re
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from openpyxl import Workbook
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend import database
from backend.inference import FIELDS
from backend.models import Folder, Screenshot
from backend.schemas import FolderIn, FolderOut

router = APIRouter(prefix="/folders", tags=["folders"])
SessionDep = Annotated[Session, Depends(database.get_session)]

SORTS = {"newest": (Folder.created_at.desc(), Folder.id.desc()), "name": (func.lower(Folder.name), Folder.id)}


def folder_stats():
    """Folders with their screenshot, report and still-pending counts."""
    pending = and_(Screenshot.report.is_(None), Screenshot.error.is_(None))
    return (
        select(
            Folder,
            func.count(Screenshot.id).label("screenshots"),
            func.count(Screenshot.report).label("reports"),
            func.count(Screenshot.id).filter(pending).label("pending"),
        )
        .outerjoin(Screenshot)
        .group_by(Folder.id)
    )


def to_out(row) -> FolderOut:
    folder, screenshots, reports, pending = row
    return FolderOut(id=folder.id, name=folder.name, created_at=folder.created_at,
                     screenshots=screenshots, reports=reports, pending=pending)


def get_folder(session: Session, folder_id: int) -> FolderOut:
    row = session.execute(folder_stats().where(Folder.id == folder_id)).one_or_none()
    if not row:
        raise HTTPException(404, "Folder not found")
    return to_out(row)


def ensure_name_free(session: Session, name: str, folder_id: int | None = None):
    # Unique ignoring case; the database index is exact-case only (see prisma/schema.prisma).
    query = select(Folder.id).where(func.lower(Folder.name) == name.lower())
    if folder_id is not None:
        query = query.where(Folder.id != folder_id)
    if session.scalar(query) is not None:
        raise HTTPException(409, f'A folder named "{name}" already exists')


@router.get("", response_model=list[FolderOut])
def list_folders(session: SessionDep, sort: Literal["newest", "name"] = "newest"):
    return [to_out(row) for row in session.execute(folder_stats().order_by(*SORTS[sort]))]


@router.post("", status_code=201, response_model=FolderOut)
def create_folder(folder: FolderIn, session: SessionDep):
    ensure_name_free(session, folder.name)
    row = Folder(name=folder.name)
    session.add(row)
    try:
        session.commit()
    except IntegrityError as exc:  # lost a race with an identical name
        raise HTTPException(409, f'A folder named "{folder.name}" already exists') from exc
    return get_folder(session, row.id)


@router.patch("/{folder_id}", response_model=FolderOut)
def rename_folder(folder_id: int, folder: FolderIn, session: SessionDep):
    row = session.get(Folder, folder_id)
    if not row:
        raise HTTPException(404, "Folder not found")
    ensure_name_free(session, folder.name, folder_id)
    row.name = folder.name
    try:
        session.commit()
    except IntegrityError as exc:
        raise HTTPException(409, f'A folder named "{folder.name}" already exists') from exc
    return get_folder(session, folder_id)


@router.get("/{folder_id}/export.xlsx")
def export_excel(folder_id: int, session: SessionDep):
    folder = get_folder(session, folder_id)
    shots = session.scalars(
        select(Screenshot)
        .where(Screenshot.folder_id == folder_id, Screenshot.report.is_not(None))
        .order_by(Screenshot.created_at)
    ).all()
    book = Workbook()
    sheet = book.active
    sheet.title = "Reports"
    sheet.append(["id", "captured_at", "source", *FIELDS, "report"])
    for shot in shots:
        sheet.append([shot.id, shot.created_at.astimezone().replace(tzinfo=None), shot.source,
                      *((shot.fields or {}).get(key, "") for key in FIELDS), shot.report])
        for cell in sheet[sheet.max_row]:
            if cell.data_type == "f":  # OCR text starting with "=" must stay text, not become a formula
                cell.data_type = "s"
    out = BytesIO()
    book.save(out)
    filename = re.sub(r"[^\w\- ]+", "_", folder.name).strip() or "reports"
    return Response(out.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'})

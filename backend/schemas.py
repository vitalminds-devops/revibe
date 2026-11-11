"""Request and response shapes of the API (what the frontend's lib/api.ts expects)."""
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, StringConstraints


class FolderIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class FolderOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    screenshots: int
    reports: int
    pending: int


class ShotOut(BaseModel):
    id: int
    folder_id: int
    image_key: str
    image_url: str
    source: Literal["upload", "screen"]
    created_at: datetime
    fields: dict[str, str] | None
    report: str | None
    error: str | None

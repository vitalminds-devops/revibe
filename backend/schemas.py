"""Request and response shapes of the API (what the frontend's lib/api.ts expects)."""
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, StringConstraints


class FolderIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class TextIn(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=12000)]


class FolderOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    archived: bool
    screenshots: int
    reports: int
    pending: int


class ShotOut(BaseModel):
    id: int
    folder_id: int
    image_key: str | None
    image_url: str | None
    source: Literal["upload", "screen", "text"]
    text: str | None
    created_at: datetime
    fields: dict[str, str] | None
    report: str | None
    error: str | None

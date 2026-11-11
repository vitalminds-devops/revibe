"""ReVibe API: folders of screenshots -> local OCR/LLM accomplishment reports."""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend import config, database
from backend.routers import folders, screenshots


@asynccontextmanager
async def lifespan(_app):
    config.require_settings()
    database.check_schema()
    yield


app = FastAPI(title="ReVibe report generator", lifespan=lifespan)
app.include_router(folders.router)
app.include_router(screenshots.router)

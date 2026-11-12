"""SQLAlchemy models for the report tables.

Prisma owns the schema and its migrations (frontend/prisma/schema.prisma); these classes only
map the existing tables. Keep both in sync when a column changes.
"""
from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# BIGSERIAL in Postgres; SQLite (tests) only auto-increments INTEGER primary keys.
BigId = BigInteger().with_variant(Integer, "sqlite")


class Base(DeclarativeBase):
    pass


class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # hidden from the main list
    screenshots: Mapped[list["Screenshot"]] = relationship(back_populates="folder", passive_deletes=True)


class Screenshot(Base):
    __tablename__ = "screenshots"

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    folder_id: Mapped[int] = mapped_column(ForeignKey("folders.id", ondelete="CASCADE"), index=True)
    image_key: Mapped[str | None] = mapped_column(Text)  # None for pasted text
    source: Mapped[str] = mapped_column(Text)  # "upload" | "screen" | "text"
    text: Mapped[str | None] = mapped_column(Text)  # pasted report text, read instead of an image
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    fields: Mapped[dict | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"))
    report: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    folder: Mapped[Folder] = relationship(back_populates="screenshots")

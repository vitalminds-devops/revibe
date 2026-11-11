"""SQLAlchemy engine and per-request sessions. Tables are created by Prisma migrations, not here."""
from collections.abc import Iterator
from functools import lru_cache
import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from backend.models import Base


def sqlalchemy_url(url: str) -> str:
    """postgresql://... -> postgresql+psycopg://..., dropping Prisma-only options like ?schema=."""
    parts = urlsplit(url)
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query) if k != "schema"])
    return urlunsplit(parts._replace(scheme="postgresql+psycopg", query=query))


@lru_cache(maxsize=1)
def engine() -> Engine:
    return create_engine(
        sqlalchemy_url(os.environ["DATABASE_URL"]),
        pool_pre_ping=True,  # survive idle connections dropped by hosted Postgres
        connect_args={"connect_timeout": 10},
    )


@lru_cache(maxsize=1)
def session_factory() -> sessionmaker[Session]:
    return sessionmaker(engine(), expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one session per request, committed by the route when it writes."""
    with session_factory()() as session:
        yield session


def check_schema():
    missing = set(Base.metadata.tables) - set(inspect(engine()).get_table_names())
    if missing:
        raise RuntimeError(
            f"Database tables {sorted(missing)} are missing. Run `npm run db:migrate` in frontend/ first."
        )

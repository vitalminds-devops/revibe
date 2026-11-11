"""Settings from the repo-root .env; variables already set in the shell win."""
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND = Path(__file__).parent
load_dotenv(BACKEND.parent / ".env")
REQUIRED = ["DATABASE_URL", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]


def require_settings():
    missing = [name for name in REQUIRED if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"Fill in {', '.join(missing)} in .env at the repo root (see .env.example)")

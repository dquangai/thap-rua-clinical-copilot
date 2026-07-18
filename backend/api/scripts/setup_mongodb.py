"""Create the MongoDB indexes required by the Clinical API."""
from pymongo import MongoClient

from app.config import get_settings
from app.database import ensure_indexes


def main() -> None:
    settings = get_settings()
    if not settings.mongodb_uri:
        raise SystemExit("Set MONGODB_URI before running setup")
    db = MongoClient(settings.mongodb_uri)[settings.mongodb_database]
    ensure_indexes(db)
    print("MongoDB patient and clinical-record indexes are ready")


if __name__ == "__main__":
    main()

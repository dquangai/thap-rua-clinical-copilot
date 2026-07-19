"""Seed rules phác đồ + hồ sơ demo từ file JSON bootstrap vào MongoDB.

Chạy từ backend/api (cần MONGODB_URI trong .env hoặc biến môi trường):
    python -m scripts.seed_clinical_data           # chỉ seed collection còn trống
    python -m scripts.seed_clinical_data --force   # xoá và seed lại toàn bộ
"""
import argparse

from app.database import get_database
from app.seed import SIM_COLLECTION, seed_rules, seed_sim_records


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed rules + hồ sơ demo vào MongoDB")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Xoá và seed lại kể cả khi collection đã có dữ liệu",
    )
    args = parser.parse_args()
    db = get_database()
    counts = seed_rules(db, force=args.force)
    counts[SIM_COLLECTION] = seed_sim_records(db, force=args.force)
    for collection_name, count in counts.items():
        state = f"đã seed {count} document" if count else "bỏ qua (đã có dữ liệu)"
        print(f"{collection_name}: {state}")


if __name__ == "__main__":
    main()

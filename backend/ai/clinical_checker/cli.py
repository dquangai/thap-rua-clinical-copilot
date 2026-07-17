from __future__ import annotations

import argparse
import json
from pathlib import Path

from .config import Settings
from .pipeline import run_check


def load_rules(path: Path) -> dict:
    files = sorted(path.glob("*.json")) if path.is_dir() else [path]
    if not files:
        raise RuntimeError(f"Khong tim thay rule JSON trong {path}")
    documents = [json.loads(file.read_text(encoding="utf-8-sig")) for file in files]
    return {
        "sources": [file.name for file in files],
        "rules": [rule for document in documents for rule in document.get("rules", [])],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Kiem tra tuan thu benh an, privacy-first")
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--rules", type=Path, required=True)
    parser.add_argument("--env", type=Path, default=Path(".env"))
    parser.add_argument("--log", type=Path, default=Path("results/runs.jsonl"))
    parser.add_argument("--output", type=Path, default=Path("results/result.json"))
    parser.add_argument("--dry-run", action="store_true", help="Redact + scan, khong goi network")
    args = parser.parse_args()
    settings = Settings.from_env(args.env)
    rules = load_rules(args.rules)
    inputs = sorted(args.data.glob("*.json")) if args.data.is_dir() else [args.data]
    if not inputs:
        raise RuntimeError(f"Khong tim thay JSON trong {args.data}")
    failures = []
    for input_path in inputs:
        record = json.loads(input_path.read_text(encoding="utf-8-sig"))
        output_path = args.output
        if args.data.is_dir():
            output_path = args.output / f"{input_path.stem}.result.json"
        try:
            output = run_check(record, rules, settings, args.log, args.dry_run)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Run {output['run_id']} hoan tat; output: {output_path}")
        except Exception as exc:
            failures.append(input_path.name)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(json.dumps({"status": "error", "source_file": input_path.name,
                                               "error_type": type(exc).__name__, "error": str(exc)},
                                              ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"FAILED {input_path.name}; chi tiet: {output_path}")
    if failures:
        raise SystemExit(f"{len(failures)}/{len(inputs)} file that bai: {', '.join(failures)}")


if __name__ == "__main__":
    main()

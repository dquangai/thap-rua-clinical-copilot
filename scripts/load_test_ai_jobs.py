#!/usr/bin/env python3
"""Controlled real-provider load test for the asynchronous AI job API."""

from __future__ import annotations

import argparse
import json
import statistics
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any


def request_json(method: str, url: str, payload: dict[str, Any] | None = None) -> tuple[int, dict[str, Any]]:
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as exc:
        try:
            body = json.loads(exc.read())
        except (json.JSONDecodeError, UnicodeDecodeError):
            body = {"detail": f"HTTP {exc.code}"}
        return exc.code, body


def run_one(base_url: str, record: dict[str, Any], poll_seconds: float, deadline_seconds: float) -> dict[str, Any]:
    started = time.monotonic()
    status, submitted = request_json("POST", f"{base_url}/api/v1/ai/jobs", {"record": record})
    if status != 202:
        return {"ok": False, "http_status": status, "error": submitted.get("detail"), "elapsed": 0.0}
    job_id = submitted["job_id"]
    while time.monotonic() - started < deadline_seconds:
        _, job = request_json("GET", f"{base_url}/api/v1/ai/jobs/{job_id}")
        if job.get("status") == "completed":
            result = job.get("result") or {}
            return {
                "ok": True,
                "job_id": job_id,
                "elapsed": time.monotonic() - started,
                "meta": result.get("meta") or {},
            }
        if job.get("status") == "failed":
            return {"ok": False, "job_id": job_id, "error": job.get("error"), "elapsed": time.monotonic() - started}
        time.sleep(poll_seconds)
    return {"ok": False, "job_id": job_id, "error": "deadline exceeded", "elapsed": time.monotonic() - started}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:4000")
    parser.add_argument("--jobs", type=int, default=6)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--poll-seconds", type=float, default=0.5)
    parser.add_argument("--deadline-seconds", type=float, default=180)
    args = parser.parse_args()

    files = sorted(args.data_dir.glob("*.json"))
    if not files:
        raise SystemExit("No JSON records found")
    records = [json.loads(files[index % len(files)].read_text(encoding="utf-8")) for index in range(args.jobs)]
    wall_started = time.monotonic()
    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [executor.submit(run_one, args.base_url, record, args.poll_seconds, args.deadline_seconds) for record in records]
        for future in as_completed(futures):
            results.append(future.result())

    successes = [item for item in results if item["ok"]]
    failures = [item for item in results if not item["ok"]]
    latencies = [item["elapsed"] for item in successes]
    tokens = [int(item["meta"].get("total_tokens") or 0) for item in successes]
    summary = {
        "jobs": args.jobs,
        "concurrency": args.concurrency,
        "completed": len(successes),
        "failed": len(failures),
        "wall_seconds": round(time.monotonic() - wall_started, 3),
        "latency_seconds": {
            "min": round(min(latencies), 3) if latencies else None,
            "mean": round(statistics.mean(latencies), 3) if latencies else None,
            "max": round(max(latencies), 3) if latencies else None,
        },
        "total_tokens": sum(tokens),
        "failures": [{"status": item.get("http_status"), "error": item.get("error")} for item in failures],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())

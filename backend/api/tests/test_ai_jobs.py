import asyncio
import unittest

from app.ai_jobs import AiJobQueue


class AiJobQueueTests(unittest.IsolatedAsyncioTestCase):
    async def test_processes_job_and_discards_record(self):
        queue = AiJobQueue(lambda record: {"value": record["value"]}, workers=1, max_queue=2)
        await queue.start()
        try:
            job = await queue.submit({"value": 7})
            for _ in range(100):
                if queue.get(job.id).status in {"completed", "failed"}:
                    break
                await asyncio.sleep(0.001)
            stored = queue.get(job.id)
            self.assertEqual(stored.status, "completed")
            self.assertEqual(stored.result, {"value": 7})
            self.assertEqual(stored.record, {})
        finally:
            await queue.stop()

    async def test_rejects_when_pending_queue_is_full(self):
        queue = AiJobQueue(lambda record: record, workers=1, max_queue=1)
        queue._pending = asyncio.Queue(maxsize=1)
        await queue.submit({"value": 1})
        with self.assertRaises(OverflowError):
            await queue.submit({"value": 2})


if __name__ == "__main__":
    unittest.main()

import unittest
from email.message import Message
from unittest.mock import patch
from urllib.error import HTTPError

from clinical_checker.provider import _retry_delay


class ProviderRetryTests(unittest.TestCase):
    def test_honors_retry_after(self):
        headers = Message()
        headers["Retry-After"] = "7"
        error = HTTPError("https://provider.test", 429, "limited", headers, None)
        self.assertEqual(_retry_delay(error, 0), 7.0)

    def test_caps_retry_after(self):
        headers = Message()
        headers["Retry-After"] = "600"
        error = HTTPError("https://provider.test", 429, "limited", headers, None)
        self.assertEqual(_retry_delay(error, 0), 60.0)

    @patch("clinical_checker.provider.random.uniform", return_value=1.25)
    def test_uses_jitter_without_header(self, mocked_uniform):
        self.assertEqual(_retry_delay(None, 3), 1.25)
        mocked_uniform.assert_called_once_with(0.0, 8.0)


if __name__ == "__main__":
    unittest.main()

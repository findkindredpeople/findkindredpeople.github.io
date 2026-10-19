import importlib.util
import io
import json
import tempfile
import unittest
from datetime import datetime, timezone
from email.message import Message
from pathlib import Path
from unittest.mock import MagicMock, call, patch
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location('source_check', Path(__file__).parents[1] / 'scripts/check-berlin-sources.py')
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


URL = 'https://www.berlin.de/land/kalender/index.php?detail=276751'
OTHER_URL = 'https://www.berlin.de/land/kalender/index.php?detail=266299'


def response(url=URL):
    result = MagicMock()
    result.__enter__.return_value = result
    result.geturl.return_value = url
    result.headers = Message()
    result.read.return_value = ('<h1>Library event</h1><p>' + 'Meet and read together. ' * 8 + '13.10.2099</p>').encode()
    return result


def http_error(code, retry_after=None):
    headers = Message()
    if retry_after is not None:
        headers['Retry-After'] = retry_after
    return HTTPError(URL, code, 'Source request failed', headers, io.BytesIO())


class Sources(unittest.TestCase):
    def test_navigation_noise_does_not_change_article(self):
        article = '<h1>SprachRaum</h1><p>' + 'Jeden Dienstag gemeinsam Deutsch sprechen. ' * 5 + '</p>'
        first = '<nav>old</nav><main>' + article + '<script>private dynamic noise</script></main><footer>2026</footer>'
        second = '<nav>new</nav><main>' + article + '<script>other</script></main><footer>2027</footer>'
        self.assertEqual(monitor.article_text(first), monitor.article_text(second))
        with self.assertRaises(ValueError):
            monitor.article_text('<h1>Access denied</h1>')

    def test_candidates_require_a_full_valid_future_date(self):
        text = 'Jeden Dienstag, ab Oktober. 31.02.2026, 03.10.2026, 6. Oktober 2026, 2026-10-13, 13.10.2026, 20. Oktober.'
        self.assertEqual(monitor.explicit_dates(text, '2026-10-04'), ['2026-10-06', '2026-10-13'])

    def test_source_check_cannot_fetch_arbitrary_hosts_or_credentials(self):
        self.assertTrue(monitor.allowed('https://www.berlin.de/land/kalender/index.php?detail=276751'))
        for url in ('http://www.berlin.de/x', 'https://www.berlin.de.attacker.test/x', 'https://127.0.0.1/x', 'https://name:secret@www.berlin.de/x'):
            self.assertFalse(monitor.allowed(url))

    def test_rate_limit_recovers_and_sources_are_paced(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest, state, report = (root / name for name in ('manifest.json', 'state.json', 'report.json'))
            manifest.write_text(json.dumps([{'url': URL, 'ids': ['crochet']}, {'url': OTHER_URL, 'ids': ['singing']}]))
            with patch.object(monitor, 'urlopen', side_effect=[http_error(429, '7'), response(), response(OTHER_URL)]) as fetch, \
                    patch.object(monitor.time, 'sleep') as sleep:
                self.assertEqual(monitor.run(manifest, state, report), 0)
            self.assertEqual(fetch.call_count, 3)
            self.assertEqual(sleep.call_args_list, [call(7), call(2)])
            rows = json.loads(report.read_text())['sources']
            self.assertEqual([row['status'] for row in rows], ['baseline', 'baseline'])
            self.assertEqual(rows[0]['dateCandidates'], ['2099-10-13'])
            self.assertEqual(set(json.loads(state.read_text())), {URL, OTHER_URL})

    def test_retry_after_dates_and_long_or_invalid_headers(self):
        now = datetime(2026, 10, 19, 10, 0, tzinfo=timezone.utc)
        self.assertEqual(monitor.retry_delay('Mon, 19 Oct 2026 10:00:12 GMT', 0, now), 12)
        self.assertEqual(monitor.retry_delay('Mon, 19 Oct 2026 09:00:00 GMT', 1, now), 10)
        for value in (None, '', 'not a date', '-10'):
            self.assertEqual(monitor.retry_delay(value, 0, now), 5)
        self.assertIsNone(monitor.retry_delay('120', 0, now))
        self.assertIsNone(monitor.retry_delay('Mon, 19 Oct 2026 11:00:00 GMT', 0, now))

    def test_persistent_rate_limit_still_fails_and_preserves_last_good_state(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest, state, report = (root / name for name in ('manifest.json', 'state.json', 'report.json'))
            manifest.write_text(json.dumps([{'url': URL, 'ids': ['crochet']}]))
            prior = {URL: {'hash': 'last-good-fingerprint', 'observedAt': 'previous check', 'dateCandidates': ['2099-10-13']}}
            state.write_text(json.dumps(prior))
            with patch.object(monitor, 'urlopen', side_effect=[http_error(429) for _ in range(3)]) as fetch, \
                    patch.object(monitor.time, 'sleep') as sleep:
                self.assertEqual(monitor.run(manifest, state, report), 1)
            self.assertEqual(fetch.call_count, 3)
            self.assertEqual(sleep.call_args_list, [call(5), call(10)])
            self.assertEqual(json.loads(state.read_text()), prior)
            row = json.loads(report.read_text())['sources'][0]
            self.assertEqual(row['status'], 'unavailable')
            self.assertIn('429', row['error'])

    def test_permanent_errors_and_long_server_cooldowns_are_not_retried(self):
        for code, retry_after in ((404, None), (403, None), (429, '120')):
            with self.subTest(code=code, retry_after=retry_after), \
                    patch.object(monitor, 'urlopen', side_effect=http_error(code, retry_after)) as fetch, \
                    patch.object(monitor.time, 'sleep') as sleep:
                with self.assertRaises(HTTPError):
                    monitor.fetch_article(URL)
                self.assertEqual(fetch.call_count, 1)
                sleep.assert_not_called()

    def test_temporary_server_error_can_recover(self):
        with patch.object(monitor, 'urlopen', side_effect=[http_error(503), response()]), \
                patch.object(monitor.time, 'sleep') as sleep:
            self.assertIn('Library event', monitor.fetch_article(URL))
            sleep.assert_called_once_with(5)

    def test_time_budget_prevents_more_requests_and_excessive_waits(self):
        with patch.object(monitor.time, 'monotonic', return_value=100), \
                patch.object(monitor, 'urlopen', side_effect=http_error(429, '7')) as fetch, \
                patch.object(monitor.time, 'sleep') as sleep:
            with self.assertRaises(TimeoutError):
                monitor.fetch_article(URL, deadline=99)
            fetch.assert_not_called()
            with self.assertRaises(HTTPError):
                monitor.fetch_article(URL, deadline=101)
            self.assertEqual(fetch.call_count, 1)
            sleep.assert_not_called()

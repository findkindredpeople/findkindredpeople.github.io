import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('source_check', Path(__file__).parents[1] / 'scripts/check-berlin-sources.py')
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


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

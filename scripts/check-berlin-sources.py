"""Read-only source monitor. Changes and date candidates always need editorial review."""
import argparse
import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
MAX_FETCH_ATTEMPTS = 3
MAX_RETRY_DELAY_SECONDS = 60
REQUEST_INTERVAL_SECONDS = 5
MAX_CHECK_SECONDS = 8 * 60


class Content(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ignored = 0
        self.started = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'nav', 'header', 'footer'):
            self.ignored += 1
        if tag == 'h1' and not self.ignored:
            self.started = True

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'nav', 'header', 'footer') and self.ignored:
            self.ignored -= 1

    def handle_data(self, text):
        if self.started and not self.ignored:
            self.parts.append(text)


def article_text(html):
    parser = Content()
    parser.feed(html)
    text = re.sub(r'\s+', ' ', ' '.join(parser.parts)).strip()
    for marker in ('Weitere Informationen zu diesem Auftritt', 'Weitere Informationen zu Berlin.de'):
        text = text.split(marker, 1)[0].strip()
    if len(text) < 100:
        raise ValueError('No usable article found; source needs a manual check.')
    return text


def explicit_dates(text, today):
    """Only full day/month/year strings, never a date inferred from a weekly rhythm."""
    dates = set()
    def add(year, month, day):
        try:
            date = datetime(int(year), int(month), int(day)).date().isoformat()
            if today <= date and 2000 <= int(year) <= 2100:
                dates.add(date)
        except ValueError:
            pass
    for year, month, day in re.findall(r'\b(20\d{2}|2100)-(\d{2})-(\d{2})\b', text):
        add(year, month, day)
    for day, month, year in re.findall(r'\b(\d{1,2})\.(\d{1,2})\.(20\d{2}|2100)\b', text):
        add(year, month, day)
    months = {'januar': 1, 'februar': 2, 'märz': 3, 'maerz': 3, 'april': 4,
              'mai': 5, 'juni': 6, 'juli': 7, 'august': 8, 'september': 9,
              'oktober': 10, 'november': 11, 'dezember': 12}
    pattern = r'\b(\d{1,2})\.\s*(' + '|'.join(months) + r')\s+(20\d{2}|2100)\b'
    for day, month, year in re.findall(pattern, text, re.IGNORECASE):
        add(year, months[month.lower()], day)
    return sorted(dates)


def allowed(url):
    p = urlparse(url)
    return p.scheme == 'https' and p.hostname == 'www.berlin.de' and not p.username and not p.password


def retry_delay(retry_after, attempt, now=None):
    """Respect both Retry-After formats, leaving long waits for a later run."""
    delay = 30 * (2 ** attempt)
    if retry_after:
        value = retry_after.strip()
        try:
            if re.fullmatch(r'[0-9]+', value):
                requested = int(value)
            else:
                date = parsedate_to_datetime(value)
                requested = (date - (now or datetime.now(timezone.utc))).total_seconds()
            delay = max(delay, requested)
        except (ValueError, TypeError, OverflowError):
            pass
    return delay if delay <= MAX_RETRY_DELAY_SECONDS else None


def fetch_article(url, deadline=None):
    if not allowed(url):
        raise ValueError('Only official Berlin HTTPS source URLs are allowed.')
    if deadline is None:
        deadline = time.monotonic() + MAX_CHECK_SECONDS
    request = Request(url, headers={'User-Agent': 'Kindred-source-check/1.0 (findkindredpeople.com)'})
    for attempt in range(MAX_FETCH_ATTEMPTS):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Source check time budget exhausted; review this source manually.')
        try:
            with urlopen(request, timeout=min(20, remaining)) as response:
                if not allowed(response.geturl()):
                    raise ValueError('Unexpected source redirect; review it manually.')
                raw = response.read(3 * 1024 * 1024 + 1)
                if len(raw) > 3 * 1024 * 1024:
                    raise ValueError('Source exceeded the size limit.')
                return article_text(raw.decode(response.headers.get_content_charset() or 'utf-8'))
        except HTTPError as error:
            delay = retry_delay(error.headers.get('Retry-After') if error.headers else None, attempt)
            error.close()
            if (error.code not in RETRYABLE_STATUS_CODES or attempt + 1 == MAX_FETCH_ATTEMPTS
                    or delay is None or time.monotonic() + delay >= deadline):
                raise
            print(f'HTTP {error.code}: retrying {url} in {delay:g}s '
                  f'(attempt {attempt + 2}/{MAX_FETCH_ATTEMPTS})', flush=True)
            time.sleep(delay)


def run(manifest, state_path, report_path):
    now = datetime.now(ZoneInfo('Europe/Berlin'))
    today = now.date().isoformat()
    try:
        prior = json.loads(state_path.read_text())
    except (OSError, json.JSONDecodeError):
        prior = {}
    state = dict(prior)
    results = []
    deadline = time.monotonic() + MAX_CHECK_SECONDS
    for index, source in enumerate(json.loads(manifest.read_text())):
        if index and time.monotonic() < deadline:
            time.sleep(REQUEST_INTERVAL_SECONDS)
        url = source['url']
        row = {'url': url, 'activityIds': source['ids']}
        try:
            text = fetch_article(url, deadline)
            digest = hashlib.sha256(text.encode()).hexdigest()
            old = prior.get(url)
            candidates = explicit_dates(text, today)
            row.update(status='baseline' if not old else 'changed' if digest != old['hash'] else 'unchanged',
                       dateCandidates=candidates,
                       newDateCandidates=[d for d in candidates if d not in (old or {}).get('dateCandidates', [])])
            state[url] = {'hash': digest, 'observedAt': now.isoformat(), 'dateCandidates': candidates}
        except Exception as error:
            row.update(status='unavailable', error=str(error))
            print(f'Unavailable: {url} — {error}', flush=True)
        results.append(row)
    report = {'observedAt': now.isoformat(), 'notice': 'Automated observations only. Date candidates may describe unrelated events. Review sources before editing listings or checkedOn. No dates were published automatically.', 'sources': results}
    state_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    counts = {key: sum(r['status'] == key for r in results) for key in ('baseline', 'changed', 'unchanged', 'unavailable')}
    summary = '# Berlin source check\n\n' + report['notice'] + '\n\n' + ', '.join(f'{key}: {value}' for key, value in counts.items()) + '\n\n'
    for row in results:
        summary += f"- {row['status']}: {', '.join(row['activityIds'])} — {row['url']}\n"
        if row.get('error'):
            summary += f"  Error: {row['error']}\n"
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
            output.write(summary)
    print(', '.join(f'{key}: {value}' for key, value in counts.items()))
    return 1 if counts['unavailable'] else 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', type=Path, default=Path('scripts/berlin-source-list.json'))
    parser.add_argument('--state', type=Path, default=Path('.source-check/state.json'))
    parser.add_argument('--report', type=Path, default=Path('source-report/berlin-source-check.json'))
    args = parser.parse_args()
    raise SystemExit(run(args.manifest, args.state, args.report))

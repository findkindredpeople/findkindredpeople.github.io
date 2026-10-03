"""Notify participating search engines after the Pages deployment succeeds."""
import json
import hashlib
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

host = 'findkindredpeople.com'
key = Path('indexnow-key.txt').read_text().strip()
if not re.fullmatch(r'[a-f0-9]{32}', key):
    raise SystemExit('Invalid IndexNow verification file')
known = [node.text for node in ET.parse('sitemap.xml').getroot().findall('{*}url/{*}loc')]
changed = set(subprocess.check_output(['git', 'diff', '--name-only', 'HEAD^', 'HEAD'], text=True).splitlines())
urls = [url for url in known if urlsplit(url).netloc == host and (urlsplit(url).path.lstrip('/') or 'index.html') in changed]
if '--all' in sys.argv:
    urls = [url for url in known if urlsplit(url).netloc == host]
if not urls:
    print('No changed public HTML pages to submit.')
    raise SystemExit(0)
if '--dry-run' in sys.argv:
    print(json.dumps({'urls': urls}, indent=2))
    raise SystemExit(0)
key_location = f'https://{host}/indexnow-key.txt'
# GitHub Pages publishes independently of this workflow. Wait until a changed
# page and the verification file both match this checkout before notifying.
sample_url = urls[0]
sample_path = Path(urlsplit(sample_url).path.lstrip('/') or 'index.html')
expected = hashlib.sha256(sample_path.read_bytes()).digest()
deadline = time.monotonic() + 180
while True:
    try:
        with urlopen(key_location, timeout=15) as response:
            key_matches = response.read().decode().strip() == key
        with urlopen(sample_url, timeout=15) as response:
            page_matches = hashlib.sha256(response.read()).digest() == expected
        if key_matches and page_matches:
            break
    except Exception as error:
        print(f'Waiting for publication: {type(error).__name__}', flush=True)
    if time.monotonic() >= deadline:
        raise SystemExit('The public deployment did not match in time. No URLs sent.')
    time.sleep(5)
payload = {'host': host, 'key': key, 'keyLocation': key_location, 'urlList': urls}
request = Request('https://api.indexnow.org/indexnow', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json; charset=utf-8'}, method='POST')
with urlopen(request, timeout=45) as response:
    if response.status not in (200, 202):
        raise SystemExit(f'IndexNow returned HTTP {response.status}')
    print(f'IndexNow received {len(urls)} public page URLs (HTTP {response.status}). This does not guarantee indexing.')

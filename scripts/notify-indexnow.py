"""Notify participating search engines after the Pages deployment succeeds."""
import json
from pathlib import Path
import re
import subprocess
import sys
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
with urlopen(key_location, timeout=30) as response:
    if response.read().decode().strip() != key:
        raise SystemExit('The deployed verification file does not match. No URLs sent.')
payload = {'host': host, 'key': key, 'keyLocation': key_location, 'urlList': urls}
request = Request('https://api.indexnow.org/indexnow', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json; charset=utf-8'}, method='POST')
with urlopen(request, timeout=45) as response:
    if response.status not in (200, 202):
        raise SystemExit(f'IndexNow returned HTTP {response.status}')
    print(f'IndexNow received {len(urls)} public page URLs (HTTP {response.status}). This does not guarantee indexing.')

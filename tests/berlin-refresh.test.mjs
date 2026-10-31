import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkedOn} from '../berlin-activities-data.mjs';

test('a scheduled rebuild advances both weekly snapshots and hides past events without claiming a new source check',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'kindred-refresh-'));
  const files=['berlin-activities-data.mjs','berlin-activities-de.mjs','berlin-discovery.mjs','sitemap.xml',
    'berlin-activities.html','berlin-aktivitaeten.html','berlin-this-week.html','berlin-diese-woche.html','deutsch-ueben-berlin.html',
    'scripts/site-navigation.mjs','scripts/build-time.mjs','scripts/build-berlin-page.mjs','scripts/build-berlin-discovery.mjs','scripts/build-german-practice.mjs','scripts/refresh-berlin-pages.mjs'];
  try {
    for(const file of files){await mkdir(dirname(join(temp,file)),{recursive:true});await copyFile(new URL('../'+file,import.meta.url),join(temp,file));}
    const build=date=>execFileSync(process.execPath,[join(temp,'scripts/refresh-berlin-pages.mjs')],{env:{...process.env,KINDRED_BUILD_AT:date},stdio:'pipe'});
    build('2026-10-11T09:30:00Z');
    const current=await readFile(join(temp,'berlin-this-week.html'),'utf8');
    assert.match(current,/11 October 2026 – 17 October 2026/);
    assert.match(current,/4 published sessions/);
    build('2026-10-18T09:30:00Z');
    const later=await readFile(join(temp,'berlin-this-week.html'),'utf8');
    assert.match(later,/18 October 2026 – 24 October 2026/);
    assert.match(later,/1 published session/);
    assert.match(later,/data-site-header/);
    assert.match(later,/site-navigation.css/);
    assert.equal((later.match(/id="site-navigation"/g)||[]).length,1);
    assert.doesNotMatch(later,/datetime="2026-10-17"/);
    assert.match(later,new RegExp(`Current sources checked <time datetime="${checkedOn}"`));
    assert.match(await readFile(join(temp,'berlin-diese-woche.html'),'utf8'),/18\. Oktober 2026 – 24\. Oktober 2026/);
    const catalogue=await readFile(join(temp,'berlin-activities.html'),'utf8');
    assert.match(catalogue,/id="board-game-swap"[^>]* hidden/);
    assert.match(catalogue,/12 current library programmes/);
    assert.match(await readFile(join(temp,'sitemap.xml'),'utf8'),/<loc>https:\/\/findkindredpeople\.com\/berlin-this-week\.html<\/loc>\s*<lastmod>2026-10-18<\/lastmod>/);
    build('2026-10-18T09:30:00Z');
    assert.equal(await readFile(join(temp,'berlin-this-week.html'),'utf8'),later);
  } finally {await rm(temp,{recursive:true,force:true});}
});

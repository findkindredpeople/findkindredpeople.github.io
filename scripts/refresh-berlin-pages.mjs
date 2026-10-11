import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {berlinToday} from '../berlin-activities-data.mjs';
import {buildTime} from './build-time.mjs';

const root = new URL('../',import.meta.url);
const today = berlinToday(buildTime());
const paths = ['berlin-activities.html','berlin-aktivitaeten.html','berlin-this-week.html','berlin-diese-woche.html','deutsch-ueben-berlin.html'];
const before = new Map(await Promise.all(paths.map(async path=>[path,await readFile(new URL(path,root),'utf8')])));
for (const script of ['build-berlin-page.mjs','build-berlin-discovery.mjs','build-german-practice.mjs']) {
  execFileSync(process.execPath,[new URL(script,import.meta.url).pathname],{cwd:root,stdio:'inherit'});
}
const changed = [];
for (const path of paths) if (before.get(path)!==await readFile(new URL(path,root),'utf8')) changed.push(path);
let sitemap = await readFile(new URL('sitemap.xml',root),'utf8');
for (const path of changed) {
  const url = 'https://findkindredpeople.com/'+path;
  sitemap = sitemap.replace(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g,(whole,loc,rest)=> {
    if(loc!==url) return whole;
    const updated=/<lastmod>/.test(rest) ? rest.replace(/<lastmod>[^<]*<\/lastmod>/,`<lastmod>${today}</lastmod>`) : `<lastmod>${today}</lastmod>${rest}`;
    return `<url><loc>${loc}</loc>${updated}</url>`;
  });
}
await writeFile(new URL('sitemap.xml',root),sitemap);
console.log(`Refreshed ${changed.length} Berlin pages. Source-check dates were preserved.`);

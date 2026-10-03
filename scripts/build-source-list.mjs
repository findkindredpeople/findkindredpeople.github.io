import {writeFile} from 'node:fs/promises';
import {activities} from '../berlin-activities-data.mjs';
const sources=new Map();
for(const item of activities){if(!sources.has(item.source))sources.set(item.source,{url:item.source,ids:[]});sources.get(item.source).ids.push(item.id);}
await writeFile(new URL('berlin-source-list.json',import.meta.url),JSON.stringify([...sources.values()],null,2)+'\n');

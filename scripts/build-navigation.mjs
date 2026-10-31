import {readdir,readFile,writeFile} from 'node:fs/promises';
import {decoratePage} from './site-navigation.mjs';
const root=new URL('../',import.meta.url);
const excluded=new Set(['app.html','preview.html','APP_MENU_FORUM_SNIPPET.html']);
let count=0;
for(const path of (await readdir(root)).filter(path=>path.endsWith('.html')&&!excluded.has(path))){
 const file=new URL(path,root),before=await readFile(file,'utf8'),after=decoratePage(before,path);
 if(after!==before){await writeFile(file,after);count++;}
}
console.log('Updated shared navigation on '+count+' public pages.');

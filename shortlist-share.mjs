import {selectedIds} from './berlin-activities-data.mjs';
import qrcode from './vendor/qrcode-generator/qrcode.mjs';
export function shortlistURL(ids,language='de') {
 const clean=selectedIds(Array.from(ids).join(','));
 if(!clean.length)throw new Error('Choose at least one public activity.');
 const url=new URL(language==='de'?'berlin-aktivitaeten.html':'berlin-activities.html','https://findkindredpeople.com/');
 url.searchParams.set('pick',clean.join(','));url.hash='discovery-shortlist';
 if(language!=='de')url.hash='shortlist';
 return url.href;
}
export function shortlistSVG(ids,language='de') {
 const qr=qrcode(0,'M');qr.addData(shortlistURL(ids,language),'Byte');qr.make();
 return qr.createSvgTag({cellSize:5,margin:20,scalable:true});
}

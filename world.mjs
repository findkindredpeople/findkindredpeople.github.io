import {WORLD_THEMES,WORLD_LANGUAGES,decodeWorld,worldFromUrl,compareWorlds,worldDestinations,worldDailyIndex,validWorld} from './world-core.mjs';
import {WORLD_COPY} from './world-copy.mjs';
import {WORLD_PALETTES,renderWorld} from './world-art.mjs';
import {WorldGif} from './world-gif.mjs';

const $=id=>document.getElementById(id),canvas=$('preview');
let incoming=worldFromUrl(location.href);
let language=(incoming?.language??navigator.language?.split('-')[0]);if(!WORLD_LANGUAGES.includes(language))language='en';
let draft={theme:'aurora',answers:Array(6).fill(-1),interests:[],referral:null,language};
try{const saved=JSON.parse(localStorage.getItem('kindred_world_draft_v1'));if(validWorld(saved)){language=saved.language;draft={...saved,language,referral:null};}}catch{}
let headline='';try{headline=(localStorage.getItem('kindred_world_headline')??'').slice(0,80);}catch{}
let photo=null,background=null,backgroundTheme=null,loadingTheme=null,photoUrl=null,busy=false;
let paused=matchMedia('(prefers-reduced-motion: reduce)').matches,raf=0;
const cache=new Map();
const text=key=>WORLD_COPY[language].strings[key]??WORLD_COPY.en.strings[key]??key;
const list=key=>WORLD_COPY[language].arrays[key];
const fmt=(value,a,b)=>value.replace('%1$d',String(a)).replace('%2$d',String(b));

async function loadBackground(theme){
 if(cache.has(theme))return cache.get(theme);
 const image=new Image();image.src='world-scenes/'+theme+'.webp';await image.decode();
 cache.set(theme,image);if(cache.size>4)cache.delete(cache.keys().next().value);return image;
}
function persist(){draft.language=language;try{localStorage.setItem('kindred_world_draft_v1',JSON.stringify(draft));localStorage.setItem('kindred_world_headline',headline);}catch{}}
function status(message){$('status').textContent=message;}
function setBusy(value){busy=value;document.querySelectorAll('button,input,select').forEach(x=>x.disabled=value);$('progress').hidden=!value;if(!value)renderInterests();}
function art(target,time){renderWorld(target,{theme:draft.theme,background:backgroundTheme===draft.theme?background:null,photo,headline,labels:draft.interests.map(i=>list('world_interests_list')[i]),phase:time/6000,language});}
function draw(time=performance.now()){
 if(!document.hidden)art(canvas,paused?0:time%6000);
 if(!document.hidden)raf=requestAnimationFrame(draw);
}
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);if(!document.hidden)raf=requestAnimationFrame(draw);});
$('motion').addEventListener('click',()=>{paused=!paused;$('motion').setAttribute('aria-pressed',String(paused));});
async function chooseTheme(theme){
 draft.theme=theme;persist();renderThemes();$('themeName').textContent=text('world_'+theme);
 loadingTheme=theme;
 try{const image=await loadBackground(theme);if(draft.theme===theme){background=image;backgroundTheme=theme;}}
 catch{if(draft.theme===theme)status(text('world_save_error'));}
 finally{if(loadingTheme===theme)loadingTheme=null;}
 refreshLinks();
}
function renderThemes(){
 $('themes').replaceChildren(...WORLD_THEMES.map(theme=>{
  const button=document.createElement('button');button.className='theme';button.type='button';button.setAttribute('aria-pressed',String(draft.theme===theme));button.disabled=busy;
  const swatch=document.createElement('span');swatch.className='swatch';const colors=WORLD_PALETTES[theme];swatch.style.background=`linear-gradient(135deg,${colors[0]},${colors[1]})`;
  const label=document.createElement('span');label.textContent=text('world_'+theme);button.append(swatch,label);button.addEventListener('click',()=>chooseTheme(theme));return button;
 }));
}
function renderInterests(){
 $('interests').replaceChildren(...list('world_interests_list').map((label,i)=>{
  const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(draft.interests.includes(i)));
  button.disabled=busy||(!draft.interests.includes(i)&&draft.interests.length>=3);
  button.addEventListener('click',()=>{draft.interests=draft.interests.includes(i)?draft.interests.filter(x=>x!==i):[...draft.interests,i];persist();renderInterests();renderComparison();refreshLinks();});return button;
 }));
}
function renderQuestions(){
 $('questions').replaceChildren(...list('world_questions').map((question,i)=>{
  const section=document.createElement('div');section.className='question';const title=document.createElement('p');title.textContent=question;const choices=document.createElement('div');
  [list('world_answer_a')[i],list('world_answer_b')[i]].forEach((label,answer)=>{
   const button=document.createElement('button');button.type='button';button.className='answer';button.textContent=label;button.disabled=busy;
   button.setAttribute('aria-pressed',String(draft.answers[i]===answer));button.addEventListener('click',()=>{draft.answers[i]=answer;persist();renderQuestions();renderComparison();refreshLinks();});choices.append(button);
  });section.append(title,choices);return section;
 }));
}
function renderComparison(){
 const box=$('comparison');box.replaceChildren();box.classList.toggle('visible',!!incoming);if(!incoming)return;
 const result=compareWorlds(draft,incoming),label=document.createElement('p'),score=document.createElement('strong');label.textContent=text('world_friend_card');
 score.textContent=result.compared?fmt(text('world_score'),result.matched,result.compared):text('world_answer_more');box.append(label,score);
 if(result.sharedInterests.length){const p=document.createElement('p');p.textContent=text('world_shared_interests')+': '+result.sharedInterests.map(i=>list('world_interests_list')[i]).join(' · ');box.append(p);}
 const shared=draft.answers.findIndex((a,i)=>a>=0&&a===incoming.answers[i]);if(shared>=0){const p=document.createElement('p');p.textContent=text('world_topics')+': '+list('world_questions')[shared];box.append(p);}
}
function refreshLinks(){
 const links=worldDestinations(draft,incoming);$('openApp').href=links.web;$('play').href=links.play;$('native').href=links.android;$('native').hidden=!/Android/i.test(navigator.userAgent);$('dailyPost').href=links.web;
}
function renderCopy(){
 draft.language=language;
 document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.title=text('world_title')+' · Kindred';$('language').value=language;
 document.querySelectorAll('[data-copy]').forEach(e=>e.textContent=text(e.dataset.copy));
 $('photoLabel').textContent=({en:'Photo · optional',ru:'Фото · по желанию',de:'Foto · freiwillig',uk:'Фото · за бажанням',ar:'الصورة · اختيارية',es:'Foto · opcional',fr:'Photo · facultative',tr:'Fotoğraf · isteğe bağlı'})[language];
 $('adultNote').textContent=({en:'Kindred community is for adults aged 18 and over.',ru:'Сообщество Kindred — для взрослых от 18 лет.',de:'Die Kindred-Community ist für Erwachsene ab 18 Jahren.',uk:'Спільнота Kindred — для дорослих від 18 років.',ar:'مجتمع Kindred للبالغين من عمر 18 عامًا.',es:'La comunidad Kindred es para mayores de 18 años.',fr:'La communauté Kindred est réservée aux adultes de 18 ans et plus.',tr:'Kindred topluluğu 18 yaş ve üzeri yetişkinler içindir.'})[language];
 $('headline').value=headline;$('themeName').textContent=text('world_'+draft.theme);
 $('dailyPrompt').textContent=list('world_daily_prompts')[worldDailyIndex(Date.now()/86400000)];
 renderThemes();renderInterests();renderQuestions();renderComparison();refreshLinks();persist();
}
$('language').addEventListener('change',event=>{language=event.target.value;renderCopy();});
$('headline').addEventListener('input',event=>{headline=event.target.value.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,80);persist();});
$('photo').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 if(file.size>20*1024*1024){status(text('world_save_error'));return;}
 const url=URL.createObjectURL(file),image=new Image();image.src=url;
 try{await image.decode();if(image.width*image.height>80000000)throw new Error('Large image');if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=url;photo=image;}
 catch{URL.revokeObjectURL(url);status(text('world_save_error'));}
});
$('create').addEventListener('click',()=>{persist();status(text('world_created'));$('shareTitle').scrollIntoView({behavior:paused?'auto':'smooth',block:'center'});});
async function shareLink(){
 const url=worldDestinations(draft).share;persist();
 try{if(navigator.share){await navigator.share({title:'Kindred',text:text('world_share_text'),url});return;}}
 catch(e){if(e.name==='AbortError')return;}
 try{await navigator.clipboard.writeText(url);status(({ru:'Ссылка скопирована',de:'Link kopiert',uk:'Посилання скопійовано',ar:'تم نسخ الرابط',es:'Enlace copiado',fr:'Lien copié',tr:'Bağlantı kopyalandı',en:'Link copied'})[language]);}
 catch{$('copyFallback').hidden=false;$('copyFallback').value=url;$('copyFallback').focus();$('copyFallback').select();}
}
$('shareLink').addEventListener('click',shareLink);
function download(blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Kindred-My-World.gif';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function gif(share){
 if(busy)return;setBusy(true);status('');$('progress').value=0;
 try{
  if(backgroundTheme!==draft.theme){background=await loadBackground(draft.theme);backgroundTheme=draft.theme;}
  const target=document.createElement('canvas');target.width=540;target.height=675;
  const encoder=new WorldGif(target.width,target.height);
  for(let i=0;i<60;i++){art(target,i*100);encoder.frame(target.getContext('2d',{willReadFrequently:true}).getImageData(0,0,target.width,target.height).data);$('progress').value=i+1;await new Promise(resolve=>setTimeout(resolve,0));}
  const blob=encoder.finish(),file=new File([blob],'Kindred-My-World.gif',{type:'image/gif'});persist();
  if(share&&navigator.canShare?.({files:[file]})){
   try{await navigator.share({files:[file],title:'Kindred',text:text('world_share_text')+'\n'+worldDestinations(draft).share});}
   catch(e){if(e.name!=='AbortError')download(blob);}
  }else{download(blob);status(text('world_saved'));}
 }catch{status(text('world_save_error'));}finally{setBusy(false);}
}
$('shareGif').addEventListener('click',()=>gif(true));$('saveGif').addEventListener('click',()=>gif(false));
window.addEventListener('hashchange',()=>{incoming=worldFromUrl(location.href);renderComparison();refreshLinks();});
renderCopy();chooseTheme(draft.theme);raf=requestAnimationFrame(draw);

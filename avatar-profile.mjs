const names = {en:"Live avatar", ru:"Живая аватарка", uk:"Жива аватарка", de:"Lebendiges Profilbild",
  ar:"صورة ملف متحركة", fr:"Avatar animé", es:"Avatar animado", tr:"Canlı avatar"};
const complete = {en:"Save your profile to apply this avatar.", ru:"Чтобы установить аватарку, сохрани профиль.",
  uk:"Щоб установити аватарку, збережи профіль.", de:"Speichere dein Profil, um das Profilbild zu übernehmen.",
  ar:"احفظ ملفك الشخصي لتعيين الصورة.", fr:"Enregistre ton profil pour utiliser cet avatar.",
  es:"Guarda tu perfil para aplicar el avatar.", tr:"Avatarı uygulamak için profilini kaydet."};
const prefix = "data:image/gif;base64,";
export function isAvatarPhoto(value) {
  return typeof value==="string" && value.length<=680022 && value.startsWith(prefix) &&
    /^R0lGOD[dlh]/.test(value.slice(prefix.length,prefix.length+8)) && /^[A-Za-z0-9+/]+={0,2}$/.test(value.slice(prefix.length));
}
export function validProfileGif(value) {
  if(!isAvatarPhoto(value))return false;
  let raw;
  try{raw=atob(value.slice(prefix.length));}catch(_){return false;}
  if(raw.length<32 || raw.length>510000 || !["GIF87a","GIF89a"].includes(raw.slice(0,6)))return false;
  const u=i=>raw.charCodeAt(i), word=i=>u(i)|(u(i+1)<<8);
  const size=word(6);
  if(size<1 || size>512 || word(8)!==size)return false;
  const table=f=>(f&128)?3<<(1+(f&7)):0;
  let pos=13+table(u(10)), frames=0;
  function blocks(){while(pos<raw.length){const n=u(pos++);if(!n)return true;pos+=n;}return false;}
  while(pos<raw.length){
    const tag=u(pos++);
    if(tag===0x3b)return frames>=2 && pos===raw.length;
    if(tag===0x21){if(pos>=raw.length)return false;pos++;if(!blocks())return false;continue;}
    if(tag!==0x2c || pos+9>raw.length || ++frames>64)return false;
    if(!word(pos+4)||!word(pos+6)||word(pos)+word(pos+4)>size||word(pos+2)+word(pos+6)>size)return false;
    pos+=9+table(u(pos+8));const lzw=u(pos++);
    if(!(lzw>=2 && lzw<=8) || !blocks())return false;
  }
  return false;
}

export function mountAvatarStudio({button,dialog,getUid,getPhoto,getLanguage,save,notify}) {
  let frame=null,owner=null,busy=false;
  const origin=window.location.origin;
  function refresh(){
    const name=names[getLanguage()]||names.en;
    button.textContent=name;dialog.setAttribute("aria-label",name);
    if(frame)frame.title=name;
  }
  function send(action,data={}){frame?.contentWindow?.postMessage({channel:"kindred-avatar",action,...data},origin);}
  function cleanup(){
    frame?.remove();frame=null;owner=null;busy=false;
  }
  function close(){
    if(dialog.open)dialog.close();
    cleanup();
  }
  function open(){
    if(frame || !getUid())return;
    owner=getUid();frame=document.createElement("iframe");frame.title=button.textContent;
    frame.src="./portrait.html?profile=1";dialog.replaceChildren(frame);dialog.showModal();
  }
  async function receive(event){
    if(!frame || !dialog.open || event.origin!==origin || event.source!==frame.contentWindow ||
        event.data?.channel!=="kindred-avatar")return;
    if(owner!==getUid()){close();return;}
    const {action,gif}=event.data;
    if(action==="ready"){
      const photo=getPhoto()||"";
      // Only inline photos can enter the offline editor. External profile URLs keep their normal display.
      send("init",{language:getLanguage(),photo:photo.length<=740000 && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(photo)?photo:""});
    }else if(action==="close" && !busy){close();}
    else if(action==="apply" && !busy){
      if(!validProfileGif(gif)){send("result",{result:"error"});return;}
      const ownerAtStart=owner,frameAtStart=frame;
      busy=true;
      try{
        const status=await save(ownerAtStart,gif);
        if(frame!==frameAtStart || ownerAtStart!==getUid())return;
        close();
        notify(status==="draft"?(complete[getLanguage()]||complete.en):null);
      }catch(_){
        if(frame===frameAtStart)send("result",{result:"error"});
      }finally{if(frame===frameAtStart)busy=false;}
    }
  }
  dialog.addEventListener("cancel",e=>{e.preventDefault();if(!busy)close();});
  dialog.addEventListener("close",()=>{if(!dialog.open)cleanup();});
  window.addEventListener("message",receive);button.addEventListener("click",open);refresh();
  return {open,refresh,closeIfOwnerChanged(){if(frame && owner!==getUid())close();}};
}

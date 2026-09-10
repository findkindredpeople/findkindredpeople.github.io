(()=>{
  const key="kindred_privacy_choice";
  const style=document.createElement("style");
  style.textContent='.kindred-consent{position:fixed;left:18px;right:18px;bottom:18px;z-index:9999;max-width:760px;max-height:calc(100dvh - 36px);overflow:auto;margin:auto;background:#fff;color:#30275d;border:1px solid #d8cbed;border-radius:24px;box-shadow:0 20px 60px #36215a35;padding:20px;font:16px/1.5 system-ui,sans-serif}.kindred-consent strong{font:800 22px/1.25 system-ui,sans-serif}.kindred-consent p{margin:9px 0 17px}.kindred-consent-actions{display:flex;gap:10px;flex-wrap:wrap}.kindred-consent button,.kindred-consent a{border:1px solid #cdbfe5;border-radius:999px;padding:11px 17px;background:#fff;color:#30275d;font:800 15px/1.3 system-ui,sans-serif;text-decoration:none;cursor:pointer;text-align:center}.kindred-consent .primary{border:0;background:linear-gradient(105deg,#7657f6,#f03ea1);color:#fff;box-shadow:0 9px 22px #7a48ee38}.privacy-settings{position:fixed;right:14px;bottom:14px;z-index:9998;border:1px solid #d8cbed;border-radius:999px;background:#fff;color:#30275d;padding:8px 12px;font-weight:700;cursor:pointer;box-shadow:0 8px 22px #49316f1f}@media(max-width:560px){.kindred-consent{left:10px;right:10px;bottom:10px;max-height:calc(100dvh - 20px);padding:17px}.kindred-consent-actions{display:grid;grid-template-columns:1fr}.kindred-consent-actions>*{width:100%}}';
  document.head.appendChild(style);

  function rememberChoice(value){
    try{localStorage.setItem(key,value);return}catch(error){}
    try{sessionStorage.setItem(key,value);return}catch(error){}
    try{document.cookie=key+"="+encodeURIComponent(value)+"; Max-Age=31536000; Path=/; SameSite=Lax"}catch(error){}
  }

  function hasChoice(){
    try{if(localStorage.getItem(key))return true}catch(error){}
    try{if(sessionStorage.getItem(key))return true}catch(error){}
    return document.cookie.split(";").some(item=>item.trim().startsWith(key+"="));
  }

  function forgetChoice(){
    try{localStorage.removeItem(key)}catch(error){}
    try{sessionStorage.removeItem(key)}catch(error){}
    document.cookie=key+"=; Max-Age=0; Path=/; SameSite=Lax";
  }

  function closeConsent(box){
    rememberChoice("essential");
    box.remove();
    addSettings();
  }

  function show(){
    if(document.querySelector(".kindred-consent"))return;
    const box=document.createElement("section");
    box.className="kindred-consent";
    box.setAttribute("role","dialog");
    box.setAttribute("aria-label","Privacy choices");
    box.innerHTML='<strong>Your privacy choices</strong><p>Kindred uses essential browser storage to remember your privacy choice. Advertising and optional analytics are currently disabled.</p><div class="kindred-consent-actions"><button class="primary" type="button" data-choice="essential">Confirm essential only</button><a href="privacy.html">Privacy details</a></div>';
    box.addEventListener("click",event=>{
      const choiceButton=event.target.closest&&event.target.closest("[data-choice]");
      if(!choiceButton||!box.contains(choiceButton))return;
      event.preventDefault();
      closeConsent(box);
    });
    document.body.appendChild(box);
  }

  function addSettings(){
    if(document.querySelector(".privacy-settings"))return;
    const button=document.createElement("button");
    button.className="privacy-settings";
    button.type="button";
    button.textContent="Privacy";
    button.setAttribute("aria-label","Review privacy choices");
    button.addEventListener("click",()=>{forgetChoice();button.remove();show()});
    document.body.appendChild(button);
  }

  document.addEventListener("DOMContentLoaded",()=>hasChoice()?addSettings():show());
})();

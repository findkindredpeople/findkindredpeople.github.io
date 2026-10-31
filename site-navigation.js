(() => {
  const header=document.querySelector('[data-site-header]');
  if(!header)return;
  const button=header.querySelector('.site-menu-toggle');
  const text=header.querySelector('[data-menu-text]');
  const tools=header.querySelector('.site-tools');
  const mobile=window.matchMedia('(max-width: 960px)');
  function setOpen(open,restoreFocus=false){
    const expanded=Boolean(open&&mobile.matches);
    header.dataset.menuOpen=String(expanded);
    button.setAttribute('aria-expanded',String(expanded));
    text.textContent=expanded?header.dataset.closeLabel:header.dataset.menuLabel;
    if(!expanded&&tools)tools.open=false;
    if(restoreFocus&&mobile.matches)button.focus();
  }
  button.addEventListener('click',()=>setOpen(button.getAttribute('aria-expanded')!=='true'));
  header.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    if(tools?.open){tools.open=false;tools.querySelector('summary').focus();}
    else if(button.getAttribute('aria-expanded')==='true')setOpen(false,true);
  });
  header.addEventListener('click',event=>{
    if(event.target.closest('a'))setOpen(false);
  });
  document.addEventListener('click',event=>{
    if(!header.contains(event.target))setOpen(false);
  });
  mobile.addEventListener('change',()=>setOpen(false));
  window.addEventListener('pageshow',()=>setOpen(false));
  setOpen(false);
  header.dataset.enhanced='true';
})();

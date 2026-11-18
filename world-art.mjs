const TAU=Math.PI*2;
const wave=x=>Math.sin(x*TAU);
function random(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export const WORLD_PALETTES={
 aquarium:['#07384c','#1b7985'],forest:['#53301e','#d3944e'],new_year:['#132b50','#b7d1e1'],
 sunset:['#6651a5','#f5a180'],ocean:['#8fd8e1','#167a94'],aurora:['#061628','#3c978e'],rain_city:['#171d3c','#c88a83'],
 sakura:['#b6c8e6','#f8ccd9'],cosmos:['#0c0f2a','#8a4aaf'],winter_forest:['#7390ac','#d9e4ec'],mountain_lake:['#246f7f','#9fcfc4'],
 fireflies:['#102f2d','#a4b876'],lavender:['#7560ae','#cab7e9'],tropical:['#168d93','#c8ebdf'],moonlight:['#152d59','#799bb8'],
 neon_city:['#130d31','#dc699b'],golden_hour:['#d78b60','#ffe6af'],butterflies:['#53978c','#cde8cb'],rose_garden:['#733f66','#dea5b7'],
 desert:['#7a6592','#f9b594'],clouds:['#8a83c5','#fbe3d2'],fireworks:['#080e29','#455978'],cozy_rain:['#353b50','#d4b3a1'],spring_meadow:['#80b9cc','#dae8ce']
};
export function renderWorld(canvas,{theme,background,photo=null,headline='',labels=[],phase=0,language='en'}) {
 const c=canvas.getContext('2d',{willReadFrequently:true}),w=1080,h=1350;
 c.save();c.scale(canvas.width/w,canvas.height/h);
 const palette=WORLD_PALETTES[theme]??WORLD_PALETTES.aurora;
 const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,palette[0]);sky.addColorStop(1,palette[1]);c.fillStyle=sky;c.fillRect(0,0,w,h);
 if(background)c.drawImage(background,0,0,w,h);
 const particles=foreground=>{
  const r=random(8727+(foreground?123:0));
  c.save();c.lineCap='round';
  if(!foreground&&theme==='aurora'){
   for(let band=0;band<3;band++){
    const glow=c.createLinearGradient(0,100,0,650);glow.addColorStop(0,'#64ffc200');glow.addColorStop(.5,'#64ffc23a');glow.addColorStop(1,'#cc87ff00');c.fillStyle=glow;
    c.beginPath();c.moveTo(-80,260+band*80);
    for(let x=-80;x<=w+80;x+=20)c.lineTo(x,260+band*80+90*Math.sin(x/210+phase*TAU+band));
    for(let x=w+80;x>=-80;x-=20)c.lineTo(x,430+band*80+75*Math.sin(x/210+phase*TAU+band));
    c.closePath();c.fill();
   }
  }
  if(!foreground&&['ocean','sunset','tropical','golden_hour','moonlight','mountain_lake'].includes(theme)){
   for(let k=0;k<12;k++){
    c.strokeStyle='#f7e4d32a';c.lineWidth=2+k*.2;c.beginPath();
    for(let x=0;x<=w;x+=25){const y=h*(theme==='mountain_lake'?.78:.55)+k*43+5*Math.sin(x/80+phase*TAU+k);x===0?c.moveTo(x,y):c.lineTo(x,y);}c.stroke();
   }
  }
  for(let i=0;i<(foreground?18:40);i++){
   const ox=r(),oy=r(),size=r(),x=ox*w+30*wave(phase+size),y=((oy+phase)%1)*h;
   c.globalAlpha=foreground?.8:.45;
   if(['rain_city','neon_city','cozy_rain'].includes(theme)){
    c.strokeStyle='#daecff';c.lineWidth=1+size*2;c.beginPath();c.moveTo(x,y);c.lineTo(x-8,y+25+size*40);c.stroke();
   }else if(['new_year','winter_forest'].includes(theme)){
    c.fillStyle='#fff';c.beginPath();c.arc(x,y,1.5+size*(foreground?6:3),0,TAU);c.fill();
   }else if(['sakura','rose_garden','lavender','forest'].includes(theme)){
    c.save();c.translate(x,y);c.rotate(phase*TAU+i);c.fillStyle=theme==='forest'?'#f8ac4d':theme==='lavender'?'#d4bbed':'#ffdfef';
    c.beginPath();c.ellipse(0,0,7+size*10,3+size*6,0,0,TAU);c.fill();c.restore();
   }else if(theme==='aquarium'){
    if(i<9){
     const fx=((ox+phase)%1.4-.2)*w,fy=h*(.18+oy*.67);c.fillStyle=i%2?'#e9aa65':'#78c7cb';
     c.beginPath();c.ellipse(fx,fy,22+size*28,9+size*12,.08*wave(phase),0,TAU);c.fill();
     c.beginPath();c.moveTo(fx-20,fy);c.lineTo(fx-42,fy-12);c.lineTo(fx-42,fy+12);c.closePath();c.fill();
    }else{c.strokeStyle='#c1f0f4';c.lineWidth=1.5;c.beginPath();c.arc(x,h-y,2+size*7,0,TAU);c.stroke();}
   }else if(['butterflies','spring_meadow'].includes(theme)&&i%3===0){
    const spread=5+Math.abs(wave(phase*3+size))*12;
    c.save();c.translate(x,h*oy+25*wave(phase+oy));c.fillStyle=i%2?'#f7ca76':'#a3c8f5';
    for(const side of [-1,1]){c.beginPath();c.ellipse(side*spread*.6,0,spread,10,side*.5,0,TAU);c.fill();}c.restore();
   }else if(theme==='clouds'&&i<7&&!foreground){
    c.fillStyle='#fff2';c.beginPath();c.ellipse(((ox+phase)%1.3-.15)*w,h*oy*.7,160,30,0,0,TAU);c.fill();
   }else if(theme==='fireworks'&&i<7&&!foreground){
    const p=(phase+i/7)%1,rr=p*170;c.globalAlpha=Math.sin(p*Math.PI)*.9;c.strokeStyle=`hsl(${i*51} 85% 82%)`;c.lineWidth=3;
    for(let j=0;j<18;j++){const a=j*TAU/18;c.beginPath();c.moveTo(x+Math.cos(a)*rr*.75,h*oy*.6+Math.sin(a)*rr*.75);c.lineTo(x+Math.cos(a)*rr,h*oy*.6+Math.sin(a)*rr);c.stroke();}
   }else{
    c.globalAlpha=(.35+.65*(.5+.5*wave(phase+i)))*(foreground?.8:.45);c.fillStyle=theme==='fireflies'?'#f3e9a0':theme==='cosmos'?'#dec8ff':'#ffe8bc';
    c.beginPath();c.arc(x,h*oy+18*wave(phase+oy),1.5+size*(foreground?5:2),0,TAU);c.fill();
   }
  }
  c.restore();
 };
 particles(false);
 if(photo){
  const pw=620,ph=760,left=(w-pw)/2,top=300;
  c.save();c.beginPath();c.roundRect(left,top,pw,ph,35);c.clip();
  const scale=Math.max(pw/photo.width,ph/photo.height),iw=photo.width*scale,ih=photo.height*scale;
  c.drawImage(photo,left+(pw-iw)/2,top+(ph-ih)/2,iw,ih);c.restore();
 }
 particles(true);
 const shade=c.createLinearGradient(0,h*.65,0,h);shade.addColorStop(0,'#0000');shade.addColorStop(1,'#211a3755');c.fillStyle=shade;c.fillRect(0,0,w,h);
 c.fillStyle='#fff';c.textAlign='center';c.direction=language==='ar'?'rtl':'ltr';c.shadowColor='#0009';c.shadowBlur=7;
 c.font='700 44px system-ui,sans-serif';let line='',lines=[];
 for(const word of headline.slice(0,80).split(/\s+/)){const next=line?line+' '+word:word;if(c.measureText(next).width>900&&line){lines.push(line);line=word;}else line=next;}
 if(line)lines.push(line);lines.slice(0,2).forEach((line,i)=>c.fillText(line,w/2,h-170+i*52,920));
 c.font='31px system-ui,sans-serif';c.fillText(labels.slice(0,3).join('  ·  '),w/2,h-48,920);
 c.font='700 27px system-ui,sans-serif';c.textAlign='left';c.direction='ltr';c.globalAlpha=.9;c.fillText('Kindred · findkindredpeople.com',38,47,700);
 c.restore();
}

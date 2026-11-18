export class WorldPalette {
 constructor(rgba){
  const count=new Int32Array(32768),red=new Int32Array(32768),green=new Int32Array(32768),blue=new Int32Array(32768);
  for(let i=0;i<rgba.length;i+=4){const r=rgba[i],g=rgba[i+1],b=rgba[i+2],key=((r>>3)<<10)|((g>>3)<<5)|(b>>3);count[key]++;red[key]+=r;green[key]+=g;blue[key]+=b;}
  const points=[];for(let i=0;i<32768;i++)if(count[i])points.push([Math.floor(red[i]/count[i]),Math.floor(green[i]/count[i]),Math.floor(blue[i]/count[i]),count[i]]);
  function box(points){
   const ranges=[0,1,2].map(c=>{let min=255,max=0;for(const p of points){min=Math.min(min,p[c]);max=Math.max(max,p[c]);}return max-min;});
   const channel=ranges.indexOf(Math.max(...ranges)),weight=points.reduce((n,p)=>n+p[3],0);return{points,channel,weight,score:ranges[channel]*weight};
  }
  const boxes=[box(points)];
  while(boxes.length<240){
   let index=-1;for(let i=0;i<boxes.length;i++)if(boxes[i].points.length>1&&(index<0||boxes[i].score>boxes[index].score))index=i;
   if(index<0)break;
   const original=boxes.splice(index,1)[0],sorted=original.points.sort((a,b)=>a[original.channel]-b[original.channel]);let weight=0,split=1;
   for(let i=0;i<sorted.length-1;i++){weight+=sorted[i][3];split=i+1;if(weight>=original.weight/2)break;}
   boxes.push(box(sorted.slice(0,split)),box(sorted.slice(split)));
  }
  this.colors=[0x000000,0xffffff,0xff0000,0x00ff00,0x0000ff,0xffff00,0x00ffff,0xff00ff,0x808080,0xffe0b0,0xffb060,0xffa0c0,0x80d0ff,0xb0f0d0,0xb080e0,0x404060];
  for(let i=16;i<256;i++){const b=boxes[Math.min(i-16,boxes.length-1)];const c=[0,1,2].map(channel=>Math.floor(b.points.reduce((n,p)=>n+p[channel]*p[3],0)/b.weight));this.colors.push((c[0]<<16)|(c[1]<<8)|c[2]);}
  const unique=[...new Set(this.colors)].map(c=>[this.colors.indexOf(c),(c>>16)&255,(c>>8)&255,c&255]);
  this.lookup=new Uint8Array(32768);
  for(let key=0;key<32768;key++){
   const r=((key>>10)&31)*8+4,g=((key>>5)&31)*8+4,b=(key&31)*8+4;let best=0,distance=Infinity;
   for(const p of unique){const dr=r-p[1],dg=g-p[2],db=b-p[3],d=dr*dr*3+dg*dg*4+db*db*2;if(d<distance){distance=d;best=p[0];}}
   this.lookup[key]=best;
  }
 }
 index(r,g,b){return this.lookup[((r>>3)<<10)|((g>>3)<<5)|(b>>3)];}
}

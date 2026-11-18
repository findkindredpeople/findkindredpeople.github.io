import {WorldPalette} from './world-palette.mjs';
class Bytes {
  chunks=[]; buffer=new Uint8Array(16384); n=0;
  byte(value){this.buffer[this.n++]=value;if(this.n===this.buffer.length)this.flush();}
  many(values){for(const value of values)this.byte(value);}
  text(text){this.many(new TextEncoder().encode(text));}
  short(n){this.byte(n&255);this.byte((n>>8)&255);}
  flush(){if(this.n){this.chunks.push(this.buffer.slice(0,this.n));this.n=0;}}
  blob(){this.flush();return new Blob(this.chunks,{type:'image/gif'});}
}
export class WorldGif {
  constructor(width,height){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1080||height>1350)throw new RangeError('GIF dimensions');
    this.width=width;this.height=height;this.closed=false;
    this.out=new Bytes();this.codes=new Int32Array(512*256);this.generations=new Int32Array(512*256);this.generation=0;
    const o=this.out;o.text('GIF89a');o.short(width);o.short(height);o.many([247,0,0]);
  }
  frame(rgba,delay=10){
    if(this.closed||rgba.length!==this.width*this.height*4||!Number.isInteger(delay)||delay<1||delay>65535)throw new RangeError('GIF frame');
    const o=this.out;
    if(!this.palette){this.palette=new WorldPalette(rgba);for(const color of this.palette.colors)o.many([(color>>16)&255,(color>>8)&255,color&255]);o.many([33,255,11]);o.text('NETSCAPE2.0');o.many([3,1,0,0,0]);}
    o.many([33,249,4,4]);o.short(delay);o.many([0,0,44]);o.short(0);o.short(0);o.short(this.width);o.short(this.height);o.many([0,8]);
    let packed=0,count=0,block=[];
    const byte=value=>{block.push(value);if(block.length===255){o.byte(255);o.many(block);block=[];}};
    const code=value=>{packed|=value<<count;count+=9;while(count>=8){byte(packed&255);packed>>>=8;count-=8;}};
    const indexed=i=>this.palette.index(rgba[i],rgba[i+1],rgba[i+2]);
    code(256);this.generation++;let next=258,prefix=indexed(0);
    for(let i=4;i<rgba.length;i+=4){
      const symbol=indexed(i),key=(prefix<<8)|symbol;
      if(this.generations[key]===this.generation)prefix=this.codes[key];
      else {
        code(prefix);
        if(next<500){this.generations[key]=this.generation;this.codes[key]=next++;}
        else{code(256);this.generation++;next=258;}
        prefix=symbol;
      }
    }
    code(prefix);code(257);if(count>0)byte(packed&255);
    if(block.length){o.byte(block.length);o.many(block);}o.byte(0);
  }
  finish(){if(this.closed)throw new Error('GIF closed');this.closed=true;this.out.byte(59);return this.out.blob();}
}

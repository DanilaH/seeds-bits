// Locate a visible SDK close glyph in the upper-right control rail. A light
// background alone is never a control; all four diagonal arms must be present.
export function findSdkCloseCross(raw,width,height) {
  const x0=Math.floor(width*.85),x1=Math.floor(width*.99),y1=Math.min(height,Math.floor(width*.23));
  for(const light of [false,true]) {
    const ink=(x,y)=>{const p=(y*width+x)*4,r=raw[p],g=raw[p+1],b=raw[p+2];return Math.max(r,g,b)-Math.min(r,g,b)<25 &&
      (light?Math.min(r,g,b)>220:Math.min(r,g,b)>=90&&Math.max(r,g,b)<=220);};
    const seen=new Set();
    for(let y=5;y<y1;y++)for(let x=x0;x<x1;x++) {
      const key=y*width+x;if(seen.has(key)||!ink(x,y))continue;
      const queue=[[x,y]],pixels=[];seen.add(key);let left=x,right=x,top=y,bottom=y;
      while(queue.length) {
        const [cx,cy]=queue.pop();pixels.push([cx,cy]);left=Math.min(left,cx);right=Math.max(right,cx);top=Math.min(top,cy);bottom=Math.max(bottom,cy);
        for(const [nx,ny]of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]]) {
          const k=ny*width+nx;if(nx<x0||nx>=x1||ny<5||ny>=y1||seen.has(k)||!ink(nx,ny))continue;
          seen.add(k);queue.push([nx,ny]);
        }
      }
      const w=right-left+1,h=bottom-top+1;
      if(w<8||h<8||w>width*.065||h>width*.065||w/h<.75||w/h>1.33||pixels.length>w*h*.6)continue;
      const patch=(fx,fy)=>pixels.some(([px,py])=>Math.abs(px-(left+(w-1)*fx))<=Math.max(2,w*.16)&&Math.abs(py-(top+(h-1)*fy))<=Math.max(2,h*.16));
      if(![[.12,.12],[.88,.12],[.5,.5],[.12,.88],[.88,.88]].every(([fx,fy])=>patch(fx,fy)))continue;
      if(patch(0,.5)||patch(1,.5))continue;
      return {x:Math.round((left+right)/2),y:Math.round((top+bottom)/2),w,h};
    }
  }
  return null;
}

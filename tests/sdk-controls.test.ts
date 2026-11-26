import {expect,it} from "vitest";
import {findSdkCloseCross,findSdkStoryNext} from "../scripts/markets/sdk-controls.mjs";
import capturedNext from "./fixtures/sdk-next-antialias.json";
function frame(light=false,shape="cross") {
  const width=720,height=1392,raw=new Uint8Array(width*height*4);raw.fill(light?20:238);
  const dot=(x:number,y:number)=>{for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const p=((y+dy)*width+x+dx)*4;raw[p]=raw[p+1]=raw[p+2]=light?245:140;}};
  for(let n=-7;n<=7;n++)if(shape==="cross"){dot(670+n,40+n);dot(670-n,40+n);}
  else if(shape==="circle")for(let angle=0;angle<6.29;angle+=.05)dot(670+Math.round(8*Math.cos(angle)),40+Math.round(8*Math.sin(angle)));
  return {width,height,raw};
}
for(const light of [false,true])it(`finds a real close cross, light=${light}`,()=>{const f=frame(light);expect(findSdkCloseCross(f.raw,f.width,f.height)).toMatchObject({x:670,y:40});});
for(const shape of ["blank","circle"])it(`does not mistake ${shape} for a close button`,()=>{const f=frame(false,shape);expect(findSdkCloseCross(f.raw,f.width,f.height)).toBeNull();});

for(const dark of [false,true]) it(`finds the SDK Next triangle and stop bar on ${dark?"dark":"light"} background`,()=>{
  const width=720,height=1392,raw=new Uint8Array(width*height*4);raw.fill(dark?12:255);
  const dot=(x:number,y:number)=>{const p=(y*width+x)*4;raw[p]=raw[p+1]=raw[p+2]=175;};
  for(let y=56;y<=72;y++)for(let x=662;x<=662+Math.floor((8-Math.abs(y-64))*1.5);x++)dot(x,y);
  for(let y=56;y<=72;y++)dot(678,y);
  expect(findSdkStoryNext(raw,width,height)).toMatchObject({x:670,y:64});
  expect(findSdkCloseCross(raw,width,height)).toBeNull();
});

it("finds the actual SDK Next with an empty antialiased bounding-box corner",()=>{
  const width=720,height=1392,raw=new Uint8Array(width*height*4);raw.fill(255);
  const [left,top,right,bottom]=capturedNext.bounds, crop=Buffer.from(capturedNext.rgbaBase64,"base64");
  for(let y=top;y<bottom;y++)raw.set(crop.subarray((y-top)*(right-left)*4,(y-top+1)*(right-left)*4),(y*width+left)*4);
  expect(findSdkStoryNext(raw,width,height)).toMatchObject({x:670,y:680});
  expect(findSdkCloseCross(raw,width,height)).toBeNull();
  // A triangle without the separate stop bar is not a proven SDK control.
  for(let y=top;y<bottom;y++)raw.fill(255,(y*width+678)*4,(y*width+681)*4);
  expect(findSdkStoryNext(raw,width,height)).toBeNull();
});

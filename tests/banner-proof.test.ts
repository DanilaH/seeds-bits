import {describe,it,expect} from 'vitest';
import {portraitBannerPaintMatches} from '../scripts/markets/banner-proof.mjs';
// Actual 12107/31a8882 failure: source frame5 preceded the screenshot's inset revision7.
const settled={phase:'draw',loaded:1,visible:true,view:150339637,request:1,measuredRevision:7,
  screenLeft:32,screenTop:1076,width:576,height:100,left:32,top:1028,hostLeft:32,hostTop:1028,
  hostLayoutPending:false,rootLayoutPending:false,rootX:0,rootY:48,rootWidth:640,rootHeight:1136,
  rootPaddingTop:0,rootPaddingBottom:0,windowX:0,windowY:0,windowWidth:640,windowHeight:1232,
  windowPaddingTop:48,windowPaddingBottom:48,webX:0,webY:48,webWidth:640,webHeight:1136};
const source={...settled,measuredRevision:5,screenTop:1124,top:1076,hostTop:1076};
describe('native screenshot proof uses the same safe draw revision',()=>{
  it('rejects the captured 48px stale-frame / current-PNG pair',()=>{
    expect(portraitBannerPaintMatches(source,settled)).toBe(false);
    expect(portraitBannerPaintMatches(source,source)).toBe(false); // outside the actual WebView, even with matching revision
  });
  it('rejects the earlier temporary removal of native navigation padding',()=>{
    const transient={...source,rootHeight:1184,webHeight:1184,windowPaddingBottom:0};
    expect(portraitBannerPaintMatches(transient,transient)).toBe(false);
  });
  it('accepts one fully painted native placement across the PNG readback',()=>{
    expect(portraitBannerPaintMatches(settled,{...settled})).toBe(true);
  });
  it('never treats a changed revision as the same screenshot proof, even with matching coordinates',()=>{
    expect(portraitBannerPaintMatches(settled,{...settled,measuredRevision:8})).toBe(false);
  });
});

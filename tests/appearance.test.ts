import {beforeEach,expect,it,vi} from "vitest";

const native=vi.hoisted(()=>({platform:"android",setTheme:vi.fn()}));
vi.mock("@capacitor/core",()=>({
  Capacitor:{getPlatform:()=>native.platform},
  registerPlugin:()=>({setTheme:native.setTheme}),
}));
beforeEach(()=>{vi.resetModules();native.platform="android";native.setTheme.mockReset().mockResolvedValue(undefined);});

it("durable moves with the same saved theme do not repaint the Android window",async()=>{
  const {syncGameAppearance}=await import("../src/appearance");
  for(let move=0;move<12;move++)syncGameAppearance(false);
  await Promise.resolve();
  expect(native.setTheme.mock.calls).toEqual([[{dark:false}]]);
  syncGameAppearance(true);syncGameAppearance(true);
  syncGameAppearance(false);
  expect(native.setTheme.mock.calls).toEqual([[{dark:false}],[{dark:true}],[{dark:false}]]);
});
it("a failed native update can retry without an older failure clearing a newer theme",async()=>{
  let reject:(reason:Error)=>void=()=>{};
  native.setTheme.mockImplementationOnce(()=>new Promise((_,no)=>{reject=no;}));
  const {syncGameAppearance}=await import("../src/appearance");
  syncGameAppearance(false);syncGameAppearance(true);reject(new Error("old bridge call"));
  await Promise.resolve();syncGameAppearance(true);
  expect(native.setTheme).toHaveBeenCalledTimes(2);
  native.setTheme.mockRejectedValueOnce(new Error("bridge unavailable"));
  syncGameAppearance(false);await Promise.resolve();syncGameAppearance(false);
  expect(native.setTheme).toHaveBeenCalledTimes(4);
});
it("web themes do not invoke the Android bridge",async()=>{
  native.platform="web";
  const {syncGameAppearance}=await import("../src/appearance");
  syncGameAppearance(false);syncGameAppearance(true);
  expect(native.setTheme).not.toHaveBeenCalled();
});
it("an old failed call cannot invalidate a later request for the same theme",async()=>{
  let reject:(reason:Error)=>void=()=>{};
  native.setTheme.mockImplementationOnce(()=>new Promise((_,no)=>{reject=no;}));
  const {syncGameAppearance}=await import("../src/appearance");
  syncGameAppearance(false);syncGameAppearance(true);syncGameAppearance(false);
  reject(new Error("old light theme"));await Promise.resolve();syncGameAppearance(false);
  expect(native.setTheme).toHaveBeenCalledTimes(3);
});

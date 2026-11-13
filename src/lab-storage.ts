import {Capacitor} from "@capacitor/core";
import {nativePlugin} from "./monetization";
import {read} from "./platform";
export async function saveLab(key:string,value:string,expected:string|null) {
 if(!["seeds-bits.lab.trials.v1","seeds-bits.lab.shuffle.v1"].includes(key))throw Error("Invalid lab key");
 const persist=async()=>{
  if(!Capacitor.isNativePlatform()&&await read(key)!==expected)throw Error("Лабораторная партия изменилась в другой вкладке. Откройте её заново.");
  if(Capacitor.getPlatform()==="android")await nativePlugin.persistLabState({key,value});
  else localStorage.setItem(key,value);
 };
 if(Capacitor.isNativePlatform()||!navigator.locks)await persist();else await navigator.locks.request(key,persist);
}

import {test,expect,vi} from 'vitest';
import {optionalSingleFlight,optionalResult} from '../src/optional-service';
test('deadline leaves one underlying RPC, accepts its late result and permits a later retry',async()=>{
 vi.useFakeTimers();try{
  let calls=0,resolve!:(value:string)=>void;
  const operation=()=>{calls++;return new Promise<string>(ok=>{resolve=ok;});};
  const first=optionalSingleFlight('audit-once',operation);await vi.advanceTimersByTimeAsync(1001);expect(await first).toBeUndefined();expect(calls).toBe(1);
  const second=optionalSingleFlight('audit-once',operation);await Promise.resolve();expect(calls).toBe(1);
  resolve('late');expect(await second).toBe('late');
  expect(await optionalSingleFlight('audit-once',async()=>{calls++;return 'new';})).toBe('new');expect(calls).toBe(2);expect(vi.getTimerCount()).toBe(0);
 }finally{vi.useRealTimers();}
});
test('optional service rejection clears waiting timer without acknowledging anything',async()=>{
 vi.useFakeTimers();try{expect(await optionalResult(Promise.reject(new Error('unavailable')))).toBeUndefined();expect(vi.getTimerCount()).toBe(0);}finally{vi.useRealTimers();}
});

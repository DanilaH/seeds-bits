import {describe,it,expect} from 'vitest';
import {fresh,metadata,startAttempt} from '../src/progress';
import {newSession} from '../src/core';
import {homeDailySnapshot,homeDailyStatus} from '../src/home-daily';
describe('Home daily durable presentation',()=>{
  const day='2026-11-28',id='daily-v1-'+day;
  it('does not treat a preloaded session as an accepted start or mutate progress',()=>{
    const p=fresh();metadata(p);p.sessions[id]=newSession();const before=JSON.stringify(p);
    expect(homeDailyStatus(homeDailySnapshot(p),day,id)).toBe('unplayed');expect(JSON.stringify(p)).toBe(before);
    startAttempt(p,id);expect(homeDailyStatus(homeDailySnapshot(p),day,id)).toBe('started');
  });
  it('captures completion and series independently of later in-memory writes; replay stays done',()=>{
    const p=fresh();p.active=id;p.sessions[id]=newSession();metadata(p).daily={lastDay:'2026-11-27',count:2,best:2,reward:0};
    const pending=homeDailySnapshot(p);p.done.push(id);p.meta!.daily!.count=3;
    expect(homeDailyStatus(pending,day,id)).toBe('started');expect(pending.daily?.count).toBe(2);
    const ack=homeDailySnapshot(p);expect(homeDailyStatus(ack,day,id)).toBe('done');
    startAttempt(p,id);expect(homeDailyStatus(homeDailySnapshot(p),day,id)).toBe('done');
    expect(homeDailyStatus(ack,'2026-11-29','daily-v1-2026-11-29')).toBe('unplayed');
  });
});

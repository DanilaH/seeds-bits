import {test,expect} from 'vitest';
import fs from 'node:fs';
import {fresh,metadata,helpProfile,readProgress,serializeProgress,startAttempt} from '../src/progress';
import {loadBookV5} from '../src/content-v5';
import {notebookForTask,puzzleSession,dailyForTask} from '../src/puzzles';
test('actual assigned v5/v6 and daily v5 identities survive stats repair',async()=>{
 const rows=[];
 for(const rev of [5,6] as const){
 const p=fresh(),id=rev===5?'book-v1-78':'book-v1-3',day='2026-12-25',daily='daily-v5-'+day;
 if(rev===5)await loadBookV5(id);p.bookRevisions={[id]:rev};p.dailyAssignments={[day]:daily};p.active=id;p.sessions[id]=puzzleSession(notebookForTask(id,p)!);p.sessions[daily]=puzzleSession(dailyForTask(daily)!);startAttempt(p,id);startAttempt(p,daily);const m=metadata(p);m.wallet=9;m.rewardReceipts=['kept'];helpProfile(p).inventory={magnet:2,plan:3};m.completed=0;m.unassisted=1;
 const raw=serializeProgress(p),wire=JSON.parse(raw).version;let repairs=0;const q=readProgress(raw,()=>repairs++);expect(q.bookRevisions).toEqual(p.bookRevisions);expect(q.dailyAssignments).toEqual(p.dailyAssignments);expect(q.sessions).toEqual(p.sessions);expect(q.meta?.wallet).toBe(9);expect(q.meta?.rewardReceipts).toEqual(['kept']);expect(q.meta?.help?.inventory).toEqual({magnet:2,plan:3});expect(JSON.parse(serializeProgress(q)).version).toBe(wire);rows.push({rev,wire,repairs,pins:q.bookRevisions,days:q.dailyAssignments,wallet:q.meta?.wallet});
 }fs.mkdirSync('test-results/independent-12109',{recursive:true});fs.writeFileSync('test-results/independent-12109/real-pins.json',JSON.stringify(rows,null,2));
});

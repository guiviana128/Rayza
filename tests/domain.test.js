import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAppointment, validateWorkout, escapeHTML, toLocalInput, reminderTime, sanitizeWorkout, RequestGuard} from '../src/domain.js';

test('appointment rejects invalid dates and blank names', () => {
  assert.throws(()=>validateAppointment({title:' ',starts_at:'bad',reminder_minutes:15}));
  assert.throws(()=>validateAppointment({title:'Oi',starts_at:'bad',reminder_minutes:15}));
  assert.throws(()=>validateAppointment({title:'Oi',starts_at:new Date().toISOString(),reminder_minutes:-2}));
});
test('reminder uses an absolute instant across timezones',()=> {
  assert.equal(reminderTime('2026-11-20T18:00:00-03:00',30),'2026-11-20T20:30:00.000Z');
});
test('local datetime roundtrips without UTC offset being added twice',()=> {
  const date=new Date(2026,10,20,18,30);
  assert.equal(toLocalInput(date),'2026-11-20T18:30');
  assert.equal(new Date(toLocalInput(date)).getTime(),date.getTime());
});
test('user content is escaped before HTML rendering',()=> {
  assert.equal(escapeHTML('<img onerror="x"> &'), '&lt;img onerror=&quot;x&quot;&gt; &amp;');
});
test('workout requires valid exercises and days',()=> {
  assert.throws(()=>validateWorkout({title:'Pernas',days:[9],exercises:[]}));
  assert.throws(()=>validateWorkout({title:'Pernas',days:[1],exercises:[{name:'',sets:3}]}));
  assert.doesNotThrow(()=>validateWorkout({title:'Meu treino',days:[1,3],exercises:[{name:'Agachamento',sets:3,reps:'12',weight:'Livre',rest:60}]}));
});
test('malformed exercise JSON is not allowed into rendering',()=> {
  const w=sanitizeWorkout({title:'Treino',days:[1],exercises:[null,{name:'HTML',sets:'<img onerror=x>',rest:'<script>',reps:'12'}]});
  assert.deepEqual(w.exercises,[]);assert.equal(w.invalidExercises,true);
});
test('pending responses are discarded after logout, session switch or mutation',()=> {
  const guard=new RequestGuard();const beforeLogout=guard.begin('alice');
  guard.invalidate();assert.equal(guard.current(beforeLogout,null),false);
  const next=guard.begin('alice');assert.equal(guard.current(next,'bob'),false);
  guard.invalidate();assert.equal(guard.current(next,'alice'),false);
  const fresh=guard.begin('alice');assert.equal(guard.current(fresh,'alice'),true);
});

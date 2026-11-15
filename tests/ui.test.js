import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {webcrypto} from 'node:crypto';

const bundle=await build({logLevel:'silent',configFile:false,define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_ANON_KEY':'""','import.meta.env.VITE_VAPID_PUBLIC_KEY':'""'},build:{write:false}});
const script=bundle.output.find(file=>file.type==='chunk'&&file.isEntry).code;
function makePage() {
  const dom=new JSDOM('<div id="app"></div><div id="toast"></div><dialog id="editor"></dialog>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.crypto=webcrypto;
  w.eval(script);
  return dom;
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
function click(w,selector) {const target=w.document.querySelector(selector);assert.ok(target,`Missing ${selector}`);target.click();return tick();}
async function submit(w,values) {
  const form=w.document.querySelector('dialog form');for(const [name,value] of Object.entries(values))form.querySelector(`[name="${name}"]`).value=value;
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
}
test('appointments: create, edit, complete and delete; user HTML renders as text',async()=> {
  const dom=makePage(),w=dom.window;
  try {
    await click(w,'[data-action="new-appointment"]');
    await submit(w,{title:'<img src=x onerror=alert(1)>',starts_at:'2030-05-10T12:00',location:'Meu lugar',notes:'Meu plano'});
    const cards=[...w.document.querySelectorAll('.appointment')];const card=cards.find(c=>c.textContent.includes('<img src=x'));
    assert.ok(card);assert.equal(card.querySelector('img'),null);
    const id=card.querySelector('[data-action="edit-appointment"]').dataset.id;
    await click(w,`[data-action="edit-appointment"][data-id="${id}"]`);await submit(w,{title:'Plano editado'});
    assert.ok(w.document.querySelector('#app').textContent.includes('Plano editado'));
    await click(w,`[data-action="toggle-appointment"][data-id="${id}"]`);
    await click(w,'[data-filter="concluidos"]');assert.ok(w.document.querySelector('.appointment.completed'));
    await click(w,`[data-action="delete-appointment"][data-id="${id}"]`);await submit(w,{});
    assert.equal(w.document.querySelector('.appointment'),null);
  } finally {w.close();}
});
test('workouts: create multiple exercises, edit and log/unlog a session',async()=> {
  const dom=makePage(),w=dom.window;
  try {
    await click(w,'[data-tab="treinos"]');await click(w,'[data-action="new-workout"]');
    await submit(w,{title:'Meu treino A',exercise_name:'Movimento A'});
    assert.ok(w.document.querySelector('.workout-card'));
    await click(w,'[data-action="edit-workout"]');await click(w,'[data-action="add-exercise"]');
    const fields=w.document.querySelectorAll('[name="exercise_name"]');fields[1].value='Movimento B';
    await submit(w,{title:'Treino ajustado'});
    assert.equal(w.document.querySelectorAll('.exercise-list li').length,2);
    await click(w,'[data-action="log-workout"]');assert.ok(w.document.querySelector('.workout-done'));
    await click(w,'[data-action="log-workout"]');assert.equal(w.document.querySelector('.workout-done'),null);
    await click(w,'[data-action="delete-workout"]');await submit(w,{});assert.equal(w.document.querySelector('.workout-card'),null);
  } finally {w.close();}
});
test('memories: filter favorites, open gallery and edit caption',async()=> {
  const dom=makePage(),w=dom.window;
  try {
    await click(w,'[data-tab="lembrancas"]');assert.equal(w.document.querySelectorAll('.memory-card').length,3);
    await click(w,'[data-memory-filter="favoritas"]');assert.equal(w.document.querySelectorAll('.memory-card').length,2);
    await click(w,'[data-action="view-memory"]');assert.ok(w.document.querySelector('.lightbox img'));await click(w,'[data-action="close"]');
    await click(w,'[data-action="edit-memory"]');await submit(w,{title:'Uma lembrança só nossa',caption:'Meu texto especial'});
    assert.ok(w.document.querySelector('.gallery').textContent.includes('Meu texto especial'));
    await click(w,'[data-action="favorite-memory"]');assert.equal(w.document.querySelectorAll('.memory-card').length,1);
  } finally {w.close();}
});

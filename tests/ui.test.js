import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backend,page} from './helpers/ui.js';

async function makePage() {
 const b=backend();b.session={user:{id:'user-one',user_metadata:{name:'Rayza'}}};
 b.tables.memories=[1,2,3].map((n)=>({id:'m'+n,user_id:'user-one',title:'Lembran?a '+n,caption:'Texto',photo_path:'user-one/'+n+'.jpg',taken_on:'2030-01-01',favorite:n!==2}));
 return page(b);
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
function click(w,selector) {const target=w.document.querySelector(selector);assert.ok(target,`Missing ${selector}`);target.click();return tick();}
async function submit(w,values) {
  const form=w.document.querySelector('dialog form');for(const [name,value] of Object.entries(values))form.querySelector(`[name="${name}"]`).value=value;
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
}

test('letters: compose without login, then save and open with Rayza’s account',async()=> {
  const b=backend();
  const sender=(await page(b,{url:'https://rayza.test/?escrever-cartinha'})).window;
  let link;
  try {
    const form=sender.document.querySelector('[data-form="letter-compose"]');
    form.elements.title.value='sentir saudade';
    form.elements.body.value='Meu abraço está guardado pra você. <b>Um beijo!</b>';
    form.elements.link.value='https://example.org/musica?faixa=1&favorita=sim';
    form.dispatchEvent(new sender.Event('submit',{bubbles:true,cancelable:true}));
    link=form.elements.share_link.value;
    assert.ok(link.startsWith('https://rayza.test/#cartinha='));
    assert.equal(b.tables.letters,undefined);
  } finally {sender.close();}

  b.session={user:{id:'rayza',user_metadata:{name:'Rayza'}}};
  const recipient=(await page(b,{url:link})).window;
  try {
    assert.match(recipient.document.querySelector('.letter-envelope').textContent,/sentir saudade/);
    assert.doesNotMatch(recipient.document.body.textContent,/Meu abraço/);
    await click(recipient,'[data-action="save-letter"]');
    assert.equal(recipient.location.hash,'#cartinhas');
    assert.equal(b.tables.letters.length,1);
    await click(recipient,'[data-action="open-letter"]');
    const body=recipient.document.querySelector('.letter-body');
    assert.match(body.textContent,/<b>Um beijo!<\/b>/);
    assert.equal(body.querySelector('b'),null);
    assert.equal(recipient.document.querySelector('.letter-composer-link[target="_blank"]').href,'https://example.org/musica?faixa=1&favorita=sim');
  } finally {recipient.close();}
});
test('appointments: create, edit, complete and delete; user HTML renders as text',async()=> {
  const dom=await makePage(),w=dom.window;
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
  const dom=await makePage(),w=dom.window;
  try {
    await click(w,'[data-tab="treinos"]');await click(w,'[data-action="new-workout"]');
    await submit(w,{title:'Meu treino A',exercise_name:'Movimento A'});
    assert.ok(w.document.querySelector('.workout-card'));
    await click(w,'[data-action="edit-workout"]');await click(w,'[data-action="add-exercise"]');
    const fields=w.document.querySelectorAll('[name="exercise_name"]');fields[1].value='Movimento B';
    await submit(w,{title:'Treino ajustado'});
    assert.equal(w.document.querySelectorAll('.exercise-list li').length,2);
    await click(w,'[data-action="log-workout"]');
    assert.equal(w.document.querySelector('[name="photo"]').getAttribute('capture'),'user');
    await submit(w,{});
    assert.equal(w.document.querySelector('.workout-done'),null);
    assert.match(w.document.querySelector('.form-error').textContent,/Tire uma foto/);
    w.__testPhoto=new w.File(['photo'],'treino.jpg',{type:'image/jpeg'});
    await submit(w,{});
    assert.ok(w.document.querySelector('.workout-done'));
    assert.ok(w.document.querySelector('#toast.visible.workout-success'));
    await click(w,'[data-action="log-workout"]');assert.equal(w.document.querySelector('.workout-done'),null);
    await click(w,'[data-action="delete-workout"]');await submit(w,{});assert.equal(w.document.querySelector('.workout-card'),null);
  } finally {w.close();}
});
test('memories: filter favorites, open gallery and edit caption',async()=> {
  const dom=await makePage(),w=dom.window;
  try {
    await click(w,'[data-tab="lembrancas"]');assert.equal(w.document.querySelectorAll('.memory-card').length,3);
    await click(w,'[data-memory-filter="favoritas"]');assert.equal(w.document.querySelectorAll('.memory-card').length,2);
    await click(w,'[data-action="view-memory"]');assert.ok(w.document.querySelector('.lightbox img'));await click(w,'[data-action="close"]');
    await click(w,'[data-action="edit-memory"]');await submit(w,{title:'Uma lembrança só nossa',caption:'Meu texto especial'});
    assert.ok(w.document.querySelector('.gallery').textContent.includes('Meu texto especial'));
    await click(w,'[data-action="favorite-memory"]');assert.equal(w.document.querySelectorAll('.memory-card').length,1);
  } finally {w.close();}
});

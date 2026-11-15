import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backend,page,tick} from './helpers/ui.js';
async function click(w,selector){const target=w.document.querySelector(selector);assert.ok(target,`Missing ${selector}`);target.click();await tick();}
async function submit(w,values={}){const form=w.document.querySelector('dialog[open] form')||w.document.querySelector('form[data-form="auth"]');assert.ok(form);for(const [key,value]of Object.entries(values))form.querySelector(`[name="${key}"]`).value=value;form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();}
async function login(w){await submit(w,{username:'rayza.huang',password:'test-password'});assert.equal(w.document.querySelector('.form-error')?.textContent||'', '', 'Login error');}

test('production requires login; missing storage never presents fake saved activities',async()=> {
  const dom=await page(backend(),{configured:false});try{assert.ok(dom.window.document.querySelector('.auth-page'));assert.equal(dom.window.document.querySelector('.appointment'),null);assert.equal(dom.window.document.querySelector('[data-action="new-appointment"]'),null);assert.match(dom.window.document.body.textContent,/conexão|conectar|configurad/i);}finally{dom.window.close();}
});
test('login is a single fixed username without public signup or email field',async()=> {
  const dom=await page(backend());try{const d=dom.window.document;assert.equal(d.querySelector('[name="username"]').value,'rayza.huang');assert.equal(d.querySelector('[name="username"]').readOnly,true);assert.equal(d.querySelector('[name="email"]'),null);assert.equal(d.querySelector('[data-auth-mode="signup"]'),null);assert.equal(d.querySelector('[name="password"]').value,'');assert.ok(d.querySelector('.auth-card h2'));}finally{dom.window.close();}
});
test('create on phone, read on computer, edit and delete survive page reload',async()=> {
  const b=backend(),phone=await page(b);let computer,reload;
  try{
    await login(phone.window);await click(phone.window,'[data-action="new-appointment"]');
    await submit(phone.window,{title:'Plano sincronizado',starts_at:'2030-05-10T12:00',location:'Nosso lugar',notes:''});assert.equal(b.tables.appointments.length,1);
    computer=await page(b);assert.match(computer.window.document.querySelector('#app').textContent,/Plano sincronizado/);
    await click(computer.window,'[data-action="edit-appointment"]');await submit(computer.window,{title:'Plano editado'});
    reload=await page(b);assert.match(reload.window.document.querySelector('#app').textContent,/Plano editado/);
    await click(reload.window,'[data-action="delete-appointment"]');await submit(reload.window);reload.window.close();reload=await page(b);
    assert.equal(reload.window.document.querySelector('.appointment'),null);assert.equal(b.tables.appointments.length,0);
  }finally{phone.window.close();computer?.window.close();reload?.window.close();}
});
test('failed save preserves values and allows retry without duplicate records',async()=> {
  const b=backend(),dom=await page(b),w=dom.window;
  try{await login(w);await click(w,'[data-action="new-appointment"]');b.failWrites=true;
    await submit(w,{title:'Rascunho intacto',starts_at:'2030-05-10T12:00'});
    assert.equal(w.document.querySelector('#editor').open,true);assert.equal(w.document.querySelector('[name="title"]').value,'Rascunho intacto');assert.equal(b.tables.appointments.length,0);
    b.failWrites=false;await submit(w);assert.equal(b.tables.appointments.length,1);
  }finally{w.close();}
});
test('notification status failure never hides the saved appointments',async()=> {
  const b=backend();b.session={user:{id:'user-one'}};b.tables.appointments=[{id:'saved',user_id:'user-one',title:'Meu compromisso',starts_at:'2030-01-01T12:00:00Z',reminder_minutes:15,category:'pessoal',completed:false}];b.failPushRead=true;
  const dom=await page(b);try{assert.match(dom.window.document.querySelector('#app').textContent,/Meu compromisso/);}finally{dom.window.close();}
});
test('retry after a lost response reuses the same id instead of duplicating a committed activity',async()=> {
  const b=backend(),dom=await page(b),w=dom.window;
  try{await login(w);await click(w,'[data-action="new-appointment"]');b.failAfterWrite=true;
    await submit(w,{title:'Uma vez só',starts_at:'2030-05-10T12:00'});assert.equal(b.tables.appointments.length,1);assert.equal(w.document.querySelector('#editor').open,true);
    b.failAfterWrite=false;await submit(w);assert.equal(b.tables.appointments.length,1);assert.equal(w.document.querySelector('#editor').open,false);
  }finally{w.close();}
});
test('backdrop and Escape do not discard edited form or close a pending save',async()=> {
  const b=backend(),dom=await page(b),w=dom.window;let finish;
  try{await login(w);await click(w,'[data-action="new-appointment"]');const input=w.document.querySelector('[name="title"]');input.value='Não perder';input.dispatchEvent(new w.Event('input',{bubbles:true}));
    const editor=w.document.querySelector('#editor');editor.dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:1000,clientY:1000}));assert.equal(editor.open,true);
    editor.dispatchEvent(new w.Event('cancel',{cancelable:true}));assert.equal(editor.open,true);assert.equal(w.document.querySelector('[name="title"]').value,'Não perder');
    b.delayWrite=new Promise(r=>finish=r);await submit(w,{starts_at:'2030-05-10T12:00'});await click(w,'[data-action="close"]');assert.equal(editor.open,true);
    finish();await tick();assert.equal(b.tables.appointments.length,1);
  }finally{finish?.();w.close();}
});
test('retry after photo commit plus refresh failure never removes the saved file',async()=> {
  const b=backend();b.tables.memories=[{id:'old-memory',user_id:'user-one',title:'Foto anterior',photo_path:'user-one/original.jpg',taken_on:'2030-05-10',caption:'',favorite:false}];const dom=await page(b),w=dom.window;
  try{await login(w);await click(w,'[data-tab="lembrancas"]');await click(w,'[data-action="edit-memory"]');w.__testPhoto=new w.File(['photo'],'photo.jpg',{type:'image/jpeg'});b.failRefreshAfterPhoto=true;
    await submit(w,{title:'Minha foto',taken_on:'2030-05-10'});assert.equal(b.tables.memories.length,1);assert.equal(w.document.querySelector('#editor').open,true);
    b.failRefreshAfterPhoto=false;await submit(w);const path=b.tables.memories[0].photo_path;
    assert.equal((b.removedPhotos||[]).includes(path),false);assert.equal(b.uploads.length,1);assert.equal(b.tables.memories.length,1);
  }finally{w.close();}
});
test('adding an exercise without typing still requires confirmation before discarding',async()=> {
  const b=backend(),dom=await page(b),w=dom.window;
  try{await login(w);await click(w,'[data-tab="treinos"]');await click(w,'[data-action="new-workout"]');await submit(w,{title:'Meu treino',exercise_name:'Movimento'});await click(w,'[data-action="edit-workout"]');await click(w,'[data-action="add-exercise"]');await click(w,'[data-action="close"]');assert.equal(w.document.querySelector('#editor').open,true);assert.ok(w.document.querySelector('.discard-prompt'));}
  finally{w.close();}
});
test('push service failure does not prevent signing out of the account',async()=> {
  const b=backend();b.session={user:{id:'user-one'}};b.failPushRead=true;const dom=await page(b),w=dom.window;
  try{await click(w,'[data-action="logout"]');assert.equal(b.session,null);assert.ok(w.document.querySelector('.auth-page'));}finally{w.close();}
});

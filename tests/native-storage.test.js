import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRepository,emptyDatabase} from '../server/repository-core.js';
import {createSessionToken,verifySessionToken} from '../server/session.js';
test('signed session rejects tampering and expiry',()=>{
  const env={RAYZA_SESSION_SECRET:'a'.repeat(64),RAYZA_PASSWORD_HASH:'credential-version'};
  const token=createSessionToken(env,1000);assert.equal(verifySessionToken(token,env,1001).username,'rayza.huang');
  assert.equal(verifySessionToken(token+'x',env,1001),null);assert.equal(verifySessionToken(token,env,1000+32*86400000),null);
});
test('concurrent devices keep both changes by retrying conditional writes',async()=>{
  let data=emptyDatabase(),version=1;let collisions=0;
  const repo=createRepository({read:async()=>({data:structuredClone(data),etag:String(version)}),write:async(next,etag)=>{await new Promise(r=>setTimeout(r,2));if(etag!==String(version)){collisions++;throw Object.assign(Error('conflict'),{status:412});}data=structuredClone(next);version++;}});
  await Promise.all([repo.mutate(d=>{d.appointments.push({id:'one'});}),repo.mutate(d=>{d.appointments.push({id:'two'});})]);
  assert.equal(data.appointments.length,2);assert.ok(collisions>0);
});
test('deletions remain deleted after a new repository read',async()=>{
  let data={...emptyDatabase(),appointments:[{id:'one'}]};
  const repo=createRepository({read:async()=>({data:structuredClone(data),etag:'1'}),write:async next=>{data=structuredClone(next);}});
  await repo.mutate(d=>{d.appointments=d.appointments.filter(a=>a.id!=='one');});assert.deepEqual((await repo.read()).data.appointments,[]);
});

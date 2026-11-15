import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedPushEndpoint, deliverToDevices, authorized, ownsClaim} from '../server/push.js';

test('cron refuses absent/mismatched secrets',()=> {
  assert.equal(authorized(undefined,undefined),false);
  assert.equal(authorized('Bearer bad','good-secret'),false);
  assert.equal(authorized('Bearer good-secret','good-secret'),true);
});
test('push cannot be used to reach private or arbitrary servers',()=> {
  for(const url of ['https://127.0.0.1/a','http://fcm.googleapis.com/a','https://fcm.googleapis.com.evil.test/a','https://evil.test/a','https://fcm.googleapis.com:444/a']) assert.equal(isAllowedPushEndpoint(url),false);
  assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/123'),true);
  assert.equal(isAllowedPushEndpoint('https://web.push.apple.com/abc'),true);
});
test('retries skip successful devices and remove expired subscriptions',async()=> {
  const sent=[],removed=[],recorded=[];
  const devices=[{id:'done',endpoint:'https://fcm.googleapis.com/a'},{id:'new',endpoint:'https://fcm.googleapis.com/b'},{id:'gone',endpoint:'https://fcm.googleapis.com/c'}];
  const result=await deliverToDevices({devices,delivered:new Set(['done']),payload:{title:'Oi'},send:async d=>{sent.push(d.id);if(d.id==='gone') throw {statusCode:410};},record:async id=>recorded.push(id),remove:async id=>removed.push(id)});
  assert.deepEqual(sent,['new','gone']); assert.deepEqual(recorded,['new']); assert.deepEqual(removed,['gone']); assert.equal(result.failed,0);
});
test('temporary push failure is retried, not recorded as successful',async()=> {
  const result=await deliverToDevices({devices:[{id:'x',endpoint:'https://fcm.googleapis.com/a'}],delivered:new Set(),payload:{},send:async()=>{throw {statusCode:503};},record:async()=>assert.fail(),remove:async()=>assert.fail()});
  assert.equal(result.failed,1);
});
test('worker A cannot finish or send under worker B recovered lease',()=> {
  const a={attempts:1,locked_until:'2030-01-01T00:02:00Z'};
  const b={status:'processing',attempts:2,locked_until:'2030-01-01T00:04:00Z'};
  assert.equal(ownsClaim(b,a,new Date('2030-01-01T00:02:01Z')),false);
  assert.equal(ownsClaim(b,b,new Date('2030-01-01T00:02:01Z')),true);
  assert.equal(ownsClaim(b,b,new Date('2030-01-01T00:04:01Z')),false);
});
test('delivery stops between devices when time budget or claim is lost',async()=> {
  let sent=0;
  const result=await deliverToDevices({devices:[{id:'x',endpoint:'https://fcm.googleapis.com/a'}],delivered:new Set(),payload:{},canSend:async()=>false,send:async()=>sent++,record:async()=>assert.fail(),remove:async()=>assert.fail()});
  assert.equal(sent,0);assert.equal(result.failed,1);
});

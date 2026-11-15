import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deleteMemorySafely} from '../src/operations.js';
test('failed row deletion preserves original photo',async()=> {
  let photoRemoved=false;
  await assert.rejects(()=>deleteMemorySafely(async()=>{throw Error('Network');},async()=>{photoRemoved=true;}));
  assert.equal(photoRemoved,false);
});
test('photo cleanup failure keeps a recoverable orphan instead of a broken memory',async()=> {
  const calls=[];
  const result=await deleteMemorySafely(async()=>calls.push('row'),async()=>{calls.push('photo');throw Error('Network');});
  assert.deepEqual(calls,['row','photo']);assert.equal(result.cleanupFailed,true);
});

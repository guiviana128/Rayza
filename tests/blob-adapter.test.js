import {test} from 'node:test';import assert from 'node:assert/strict';
import {createBlobAdapter} from '../server/blob-adapter.js';
test('private JSON reads request identity encoding so conditional writes use the strong ETag',async()=>{
  let written=false;
  const adapter=createBlobAdapter({get:async(path,options)=>({blob:{etag:options.headers?.['accept-encoding']==='identity'?'"version-one"':'W/"version-one"'},stream:new Response('{"appointments":[]}').body}),put:async(path,body,options)=>{if(options.ifMatch!=='"version-one"')throw Error('Precondition failed: ETag mismatch');written=true;}});
  const snapshot=await adapter.read();await adapter.write(snapshot.data,snapshot.etag);assert.equal(written,true);
});

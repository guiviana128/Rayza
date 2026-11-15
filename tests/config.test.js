import {test} from 'node:test';import assert from 'node:assert/strict';
import {resolveConfig} from '../server/config.js';
test('native config only exposes readiness and public identifiers',()=>{const env={BLOB_READ_WRITE_TOKEN:'private-storage',RAYZA_SESSION_SECRET:'private-cookie',RAYZA_PASSWORD_HASH:'private-hash',VAPID_PRIVATE_KEY:'private-push'};const c=resolveConfig(env);assert.equal(c.configured,true);for(const v of Object.values(env))assert.equal(JSON.stringify(c).includes(v),false);assert.equal(resolveConfig({}).configured,false);});

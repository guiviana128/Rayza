import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveConfig} from '../server/config.js';
const jwt=role=>`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
test('Vercel Supabase integration names work without VITE prefixes',()=> {
  const c=resolveConfig({NEXT_PUBLIC_SUPABASE_URL:' https://test.supabase.co\n',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example'});
  assert.equal(c.configured,true);assert.equal(c.supabaseUrl,'https://test.supabase.co');
});
test('browser config never exposes service_role or secret keys',()=> {
  for(const key of [jwt('service_role'),'sb_secret_sensitive']) {
    const c=resolveConfig({VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_ANON_KEY:key,SUPABASE_SERVICE_ROLE_KEY:'private'});
    assert.equal(c.configured,false);assert.equal(c.supabaseKey,'');assert.equal(JSON.stringify(c).includes(key),false);
  }
});
test('only public configuration is returned; missing configuration is explicit',()=> {
  const c=resolveConfig({SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:jwt('anon'),VAPID_PRIVATE_KEY:'private',CRON_SECRET:'secret'});
  assert.equal(c.configured,true);assert.equal(c.pushConfigured,false);assert.equal('CRON_SECRET' in c,false);
  assert.equal(resolveConfig({}).configured,false);
});
test('modern Supabase secret naming enables server features without exposing the secret',()=> {
  const c=resolveConfig({SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example',SUPABASE_SECRET_KEY:'sb_secret_private',VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_KEY:'private',VAPID_SUBJECT:'https://test.example',CRON_SECRET:'cron'});
  assert.equal(c.pushConfigured,true);assert.equal(JSON.stringify(c).includes('sb_secret_private'),false);
});

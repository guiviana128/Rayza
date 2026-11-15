import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {verifyAccountPassword,createFixedSession,accountSettings} from '../server/single-account.js';
const password='test-password',salt='a'.repeat(32);
const hash=`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;
test('fixed password is verified against a server hash, never a public literal',()=> {
  assert.equal(verifyAccountPassword(password,hash),true);
  assert.equal(verifyAccountPassword('wrong',hash),false);
  assert.equal(verifyAccountPassword(password,''),false);
  assert.equal(verifyAccountPassword('x'.repeat(200),hash),false);
});
test('single account rejects any other username or password before accessing auth',async()=> {
  let calls=0;
  const env={RAYZA_USERNAME:'rayza.huang',RAYZA_PASSWORD_HASH:hash};
  await assert.rejects(()=>createFixedSession({username:'another-user',password},env,()=>{calls++;}),/Usuário ou senha/);
  await assert.rejects(()=>createFixedSession({username:'rayza.huang',password:'wrong'},env,()=>{calls++;}),/Usuário ou senha/);
  assert.equal(calls,0);
});
test('missing database yields configuration error rather than fake login success',async()=> {
  await assert.rejects(()=>createFixedSession({username:'rayza.huang',password},{RAYZA_PASSWORD_HASH:hash},()=>assert.fail()),/Supabase/);
});
test('valid fixed login returns only an ordinary session for the dedicated account',async()=> {
  const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example',SUPABASE_SERVICE_ROLE_KEY:'private-service',RAYZA_PASSWORD_HASH:hash,RAYZA_ACCOUNT_PASSWORD:'private-account-password'};
  const {email}=accountSettings(env);
  const client={auth:{signInWithPassword:async input=>{assert.equal(input.email,email);assert.equal(input.password,env.RAYZA_ACCOUNT_PASSWORD);return {data:{session:{access_token:'public-session',refresh_token:'public-refresh',user:{id:'one',email}}},error:null};}}};
  const result=await createFixedSession({username:'rayza.huang',password},env,()=>client);
  assert.equal(result.access_token,'public-session');assert.equal(JSON.stringify(result).includes('private-service'),false);
});
test('first valid login provisions only the dedicated confirmed account',async()=> {
  const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example',SUPABASE_SERVICE_ROLE_KEY:'private-service',RAYZA_PASSWORD_HASH:hash,RAYZA_ACCOUNT_PASSWORD:'private-account-password'};
  let attempts=0,created=0;
  const client={auth:{signInWithPassword:async()=>++attempts===1?{error:{code:'invalid_credentials'}}:{data:{session:{access_token:'ordinary-token',refresh_token:'refresh',user:{id:'one',email:accountSettings(env).email}}},error:null}}};
  const factory=(url,key)=>key==='private-service'?{auth:{admin:{createUser:async input=>{created++;assert.equal(input.email_confirm,true);assert.equal(input.email,accountSettings(env).email);return {data:{user:{id:'one'}},error:null};}}}}:client;
  const result=await createFixedSession({username:'rayza.huang',password},env,factory);
  assert.equal(created,1);assert.equal(result.access_token,'ordinary-token');
});

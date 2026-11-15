import {scryptSync,timingSafeEqual} from 'node:crypto';
import {resolveConfig,getSupabaseServerKey} from './config.js';

export function accountSettings(env=process.env) {
  return {username:env.RAYZA_USERNAME?.trim()||'rayza.huang',email:env.RAYZA_ACCOUNT_EMAIL?.trim()||'rayza.huang@rayza-five.vercel.app'};
}
export function verifyAccountPassword(password,encoded) {
  if(typeof password!=='string'||password.length>128||typeof encoded!=='string')return false;
  const [algorithm,salt,hex]=encoded.split(':');
  if(algorithm!=='scrypt'||!/^[a-f0-9]{32}$/.test(salt||'')||!/^[a-f0-9]{128}$/.test(hex||''))return false;
  const actual=scryptSync(password,salt,64),expected=Buffer.from(hex,'hex');
  return timingSafeEqual(actual,expected);
}
function failure(message,status=503){return Object.assign(new Error(message),{status});}
export async function createFixedSession(input,env,makeClient) {
  const settings=accountSettings(env);
  if(typeof input?.username!=='string'||input.username.trim()!==settings.username||!verifyAccountPassword(input?.password,env.RAYZA_PASSWORD_HASH))throw failure('Usuário ou senha incorretos.',401);
  const config=resolveConfig(env);
  if(!config.configured||!getSupabaseServerKey(env)||!env.RAYZA_ACCOUNT_PASSWORD)throw failure('O acesso foi configurado, mas falta conectar o Supabase ao projeto Rayza na Vercel.');
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const client=makeClient(config.supabaseUrl,config.supabaseKey,options);
  const credentials={email:settings.email,password:env.RAYZA_ACCOUNT_PASSWORD};
  let result=await client.auth.signInWithPassword(credentials);
  if(result.error) {
    if(result.error.code!=='invalid_credentials'&&!/invalid login credentials/i.test(result.error.message||''))throw failure('Não foi possível conectar a conta ao banco. Tente novamente.');
    const admin=makeClient(config.supabaseUrl,getSupabaseServerKey(env),options);
    const created=await admin.auth.admin.createUser({...credentials,email_confirm:true,user_metadata:{name:'Rayza'}});
    if(created.error)throw failure('Não foi possível preparar a conta única no Supabase. Confira a configuração do projeto.');
    result=await client.auth.signInWithPassword(credentials);
  }
  const session=result.data?.session;
  if(result.error||!session?.access_token||session.user?.email!==settings.email)throw failure('Não foi possível abrir a sessão no banco. Tente novamente.');
  return {access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in,expires_at:session.expires_at,token_type:session.token_type,user:session.user};
}

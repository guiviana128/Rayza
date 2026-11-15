import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
export const COOKIE='__Host-rayza_session';
export function createSessionToken(env=process.env,now=Date.now()) {
  const secret=env.RAYZA_SESSION_SECRET;if(!secret)throw Error('Sessão não configurada.');
  const body=Buffer.from(JSON.stringify({id:'rayza',username:env.RAYZA_USERNAME||'rayza.huang',expires:now+30*86400000,version:createHash('sha256').update(env.RAYZA_PASSWORD_HASH||'').digest('hex')})).toString('base64url');
  return `${body}.${createHmac('sha256',secret).update(body).digest('base64url')}`;
}
export function verifySessionToken(token,env=process.env,now=Date.now()) {
  try {
    if(typeof token!=='string'||token.length>2048||!env.RAYZA_SESSION_SECRET)return null;
    const [body,signature,extra]=token.split('.');if(extra)return null;
    const expected=createHmac('sha256',env.RAYZA_SESSION_SECRET).update(body).digest();const actual=Buffer.from(signature,'base64url');
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
    const data=JSON.parse(Buffer.from(body,'base64url').toString());
    if(data.id!=='rayza'||data.expires<=now||data.username!==(env.RAYZA_USERNAME||'rayza.huang')||data.version!==createHash('sha256').update(env.RAYZA_PASSWORD_HASH||'').digest('hex'))return null;
    return {id:'rayza',username:data.username,user_metadata:{name:'Rayza'}};
  }catch{return null;}
}
export function sessionUser(req) {const match=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));return verifySessionToken(match?.slice(COOKIE.length+1));}
export const sessionCookie=(token)=>`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
export const clearCookie=()=>`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
export function requireUser(req) {const user=sessionUser(req);if(!user)throw Object.assign(Error('Entre na sua conta para continuar.'),{status:401});return user;}
export function requireOrigin(req) {
  if(['GET','HEAD','OPTIONS'].includes(req.method))return;
  const expected=`https://${req.headers.host}`;
  if((req.headers.origin&&req.headers.origin!==expected)||req.headers['sec-fetch-site']==='cross-site')throw Object.assign(Error('Origem da solicitação inválida.'),{status:403});
}
export function jsonBody(req) {const body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!body||typeof body!=='object'||Array.isArray(body))throw Object.assign(Error('Dados inválidos.'),{status:400});return body;}
export function apiError(res,error) {return res.status(error.status||503).json({error:error.status?error.message:'Não foi possível acessar o armazenamento. Tente novamente.'});}

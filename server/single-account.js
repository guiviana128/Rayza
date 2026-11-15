import {scryptSync,timingSafeEqual} from 'node:crypto';
export const accountSettings=(env=process.env)=>({username:env.RAYZA_USERNAME||'rayza.huang'});
export function verifyAccountPassword(password,encoded) {
  if(typeof password!=='string'||password.length>128||typeof encoded!=='string')return false;
  const [algorithm,salt,hex]=encoded.split(':');
  if(algorithm!=='scrypt'||!/^[a-f0-9]{32}$/.test(salt||'')||!/^[a-f0-9]{128}$/.test(hex||''))return false;
  return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hex,'hex'));
}

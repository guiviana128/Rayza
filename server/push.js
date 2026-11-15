import {timingSafeEqual} from 'node:crypto';

export function authorized(header,secret) {
  if(!secret || typeof header!=='string') return false;
  const a=Buffer.from(header),b=Buffer.from(`Bearer ${secret}`);
  return a.length===b.length && timingSafeEqual(a,b);
}
export function isAllowedPushEndpoint(endpoint) {
  try {
    const u=new URL(endpoint),h=u.hostname;
    return u.protocol==='https:' && !u.username && !u.password && (!u.port || u.port==='443') && (
      h==='fcm.googleapis.com' || h==='updates.push.services.mozilla.com' ||
      h.endsWith('.push.services.mozilla.com') || h.endsWith('.push.apple.com') || h.endsWith('.notify.windows.com')
    );
  } catch { return false; }
}
export function ownsClaim(current,job,now=new Date()) {
  return current?.status==='processing' && current.attempts===job.attempts && current.locked_until===job.locked_until && Date.parse(current.locked_until)>now.getTime();
}
export async function deliverToDevices({devices,delivered,payload,send,record,remove,canSend=async()=>true}) {
  let sent=0,failed=0;
  for(const device of devices) {
    if(delivered.has(device.id)) continue;
    if(!await canSend()) {failed++;continue;}
    if(!isAllowedPushEndpoint(device.endpoint)) { await remove(device.id); continue; }
    try {
      await send(device,payload);
      await record(device.id);
      sent++;
    } catch(error) {
      if([404,410].includes(error.statusCode)) await remove(device.id);
      else failed++;
    }
  }
  return {sent,failed};
}

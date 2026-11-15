const first=(env,names)=>names.map(name=>env[name]?.trim()).find(Boolean)||'';
function safePublicKey(key) {
  if(key.startsWith('sb_publishable_'))return true;
  try {return JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{return false;}
}
export function resolveConfig(env=process.env) {
  const supabaseUrl=first(env,['SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL','VITE_SUPABASE_URL']);
  const key=first(env,['SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY','VITE_SUPABASE_ANON_KEY']);
  let validUrl=false;try{const u=new URL(supabaseUrl);validUrl=u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/';}catch{}
  const configured=validUrl&&safePublicKey(key);
  const vapidPublicKey=first(env,['VAPID_PUBLIC_KEY','VITE_VAPID_PUBLIC_KEY']);
  return {configured,supabaseUrl:configured?supabaseUrl:'',supabaseKey:configured?key:'',vapidPublicKey,pushConfigured:Boolean(configured&&vapidPublicKey&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT&&env.SUPABASE_SERVICE_ROLE_KEY&&env.CRON_SECRET)};
}

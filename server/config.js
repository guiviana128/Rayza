export function resolveConfig(env=process.env) {
  return {configured:Boolean(env.BLOB_READ_WRITE_TOKEN&&env.RAYZA_SESSION_SECRET&&env.RAYZA_PASSWORD_HASH),storage:'vercel-private',singleAccount:true,accountUsername:env.RAYZA_USERNAME||'rayza.huang',vapidPublicKey:env.VAPID_PUBLIC_KEY||'',pushConfigured:Boolean(env.BLOB_READ_WRITE_TOKEN&&env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT)};
}

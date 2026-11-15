import {resolveConfig} from '../server/config.js';
export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  // Esta lista explícita contém apenas URL/chaves públicas e indicadores booleanos.
  return res.status(200).json(resolveConfig());
}

import {sessionUser,clearCookie,requireOrigin,apiError} from '../server/session.js';
export default function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  try{
    if(req.method==='GET'){const user=sessionUser(req);return res.status(200).json({session:user?{user}:null});}
    if(req.method==='DELETE'){requireOrigin(req);res.setHeader('Set-Cookie',clearCookie());return res.status(200).json({signedOut:true});}
    return res.status(405).json({error:'Method not allowed'});
  }catch(error){return apiError(res,error);}
}

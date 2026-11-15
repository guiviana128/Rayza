import {get,put} from '@vercel/blob';
import {createRepository} from './repository-core.js';
const pathname='rayza/database-v1.json';
export const repository=createRepository({
  async read(){const result=await get(pathname,{access:'private',useCache:false});if(!result)return null;return {data:await new Response(result.stream).json(),etag:result.blob.etag};},
  async write(data,etag){return put(pathname,JSON.stringify(data),{access:'private',addRandomSuffix:false,contentType:'application/json',allowOverwrite:Boolean(etag),cacheControlMaxAge:60,...(etag?{ifMatch:etag}:{})});}
});

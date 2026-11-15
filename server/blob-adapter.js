export function createBlobAdapter({get,put}) {
  const pathname='rayza/database-v1.json';
  return {
    async read(){
      // Respostas comprimidas recebem ETag fraco W/, inválido para ifMatch no armazenamento.
      const result=await get(pathname,{access:'private',useCache:false,headers:{'accept-encoding':'identity'}});
      if(!result)return null;
      return {data:await new Response(result.stream).json(),etag:result.blob.etag};
    },
    async write(data,etag){return put(pathname,JSON.stringify(data),{access:'private',addRandomSuffix:false,contentType:'application/json',allowOverwrite:Boolean(etag),cacheControlMaxAge:60,...(etag?{ifMatch:etag}:{})});}
  };
}

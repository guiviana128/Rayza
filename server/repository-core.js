export const emptyDatabase=()=>({version:1,appointments:[],memories:[],workouts:[],logs:[],finances:[],subscriptions:[],deliveries:{},runtime:{}});
const conflict=error=>[409,412].includes(error.status)||/Precondition|AlreadyExists/.test(error.name||'')||/already exists|precondition/i.test(error.message||'');
export function createRepository(adapter) {
  async function read(){return await adapter.read()||{data:emptyDatabase(),etag:null};}
  async function mutate(change) {
    for(let attempt=0;attempt<6;attempt++) {
      const snapshot=await read(),next=structuredClone(snapshot.data),result=change(next);
      try{await adapter.write(next,snapshot.etag);return result;}
      catch(error){if(!conflict(error)||attempt===5)throw error;}
    }
  }
  return {read,mutate};
}

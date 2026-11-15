import {queue,processReminder} from '../server/notifications.js';
export default queue.handleNodeCallback(processReminder,{retry:(error,metadata)=>metadata.deliveryCount>=10?{acknowledge:true}:{afterSeconds:Math.min(300,metadata.deliveryCount*30)}});

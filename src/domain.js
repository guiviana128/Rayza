export function escapeHTML(value='') {
  return String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function toLocalInput(value=new Date()) {
  const d=new Date(value), pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function reminderTime(date,minutes) { return new Date(new Date(date).getTime()-minutes*60000).toISOString(); }
export function validateAppointment(a) {
  if(!a.title?.trim() || a.title.length>120) throw Error('Escreva um título de até 120 caracteres.');
  if(!Number.isFinite(Date.parse(a.starts_at))) throw Error('Escolha uma data e hora válidas.');
  if(![0,5,15,30,60,1440].includes(Number(a.reminder_minutes))) throw Error('Escolha uma antecedência válida.');
  return a;
}
export function validateWorkout(w) {
  if(!w.title?.trim() || w.title.length>100) throw Error('Dê um nome ao seu treino.');
  if(!Array.isArray(w.days) || w.days.some(d=>!Number.isInteger(d)||d<0||d>6)) throw Error('Escolha dias válidos.');
  if(!w.exercises?.length || w.exercises.length>30) throw Error('Adicione de 1 a 30 exercícios.');
  for(const e of w.exercises) if(!validExercise(e)) throw Error('Preencha nome, séries e repetições de cada exercício.');
  return w;
}
function validExercise(x) {
  return x && typeof x==='object' && typeof x.name==='string' && x.name.trim().length>0 && x.name.length<=100 && Number.isInteger(x.sets) && x.sets>=1 && x.sets<=100 && typeof x.reps==='string' && x.reps.trim().length>0 && x.reps.length<=30 && typeof x.weight==='string' && x.weight.length<=40 && Number.isInteger(x.rest) && x.rest>=0 && x.rest<=3600;
}
export function sanitizeWorkout(w) {
  const source=Array.isArray(w.exercises)?w.exercises:[];
  const exercises=source.filter(validExercise);
  return {...w,exercises,invalidExercises:!Array.isArray(w.exercises)||exercises.length!==source.length};
}
export class RequestGuard {
  generation=0;
  begin(userId) {return {generation:++this.generation,userId};}
  invalidate() {this.generation++;}
  current(token,userId) {return token.generation===this.generation && token.userId===userId;}
}
export const dayNames=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
export const formatDate=(date,options={day:'2-digit',month:'short'})=>new Intl.DateTimeFormat('pt-BR',options).format(new Date(date));
export const dateKey=(d=new Date())=>toLocalInput(d).slice(0,10);

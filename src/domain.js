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
export function dateKey(d=new Date()) {
  if(typeof d==='string'&&/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0,10);
  return toLocalInput(d).slice(0,10);
}
export function monthKey(d=new Date()) {
  if(typeof d==='string'&&/^\d{4}-\d{2}/.test(d)) return d.slice(0,7);
  return toLocalInput(d).slice(0,7);
}
export function shiftMonth(monthStr='',delta=0) {
  if(!monthStr||!/^\d{4}-\d{2}$/.test(monthStr)) monthStr=monthKey(new Date());
  const [y,m]=monthStr.split('-').map(Number);
  const total=(y*12+(m-1))+delta;
  const targetYear=Math.floor(total/12);
  const targetMonth=(total%12)+1;
  return `${targetYear}-${String(targetMonth).padStart(2,'0')}`;
}
export function formatBRL(value=0) {
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
}
export function validateFinance(f) {
  if(!f||typeof f!=='object') throw Error('Registro financeiro inválido.');
  if(!f.title?.trim()||f.title.length>120) throw Error('Dê um nome ao registro de até 120 caracteres.');
  const amount=Number(f.amount);
  if(!Number.isFinite(amount)||amount<=0||amount>10000000) throw Error('Informe um valor válido maior que zero.');
  if(!['expense','income'].includes(f.type)) throw Error('Escolha se é um gasto (saída) ou entrada.');
  if(!f.date||!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) throw Error('Escolha uma data válida no formato aaaa-mm-dd.');
  if(typeof f.category!=='string'||f.category.length>100) throw Error('Confira a categoria do registro.');
  if(!['credito','debito','pix','dinheiro','outro'].includes(f.payment_method)) throw Error('Escolha uma forma de pagamento válida.');
  if(typeof f.card_name!=='string'||f.card_name.length>100) throw Error('Confira o nome do cartão.');
  if(typeof f.pix_recipient!=='string'||f.pix_recipient.length>120) throw Error('Confira a identificação da chave ou destinatário Pix.');
  if(!['pago','pendente'].includes(f.status)) throw Error('Status deve ser pago ou pendente.');
  if(typeof f.notes!=='string'||f.notes.length>2000) throw Error('Observações devem ter até 2000 caracteres.');
  f.amount=Math.round(amount*100)/100;
  return f;
}

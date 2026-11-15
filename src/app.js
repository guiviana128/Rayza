import './style.css';
import {escapeHTML as e,validateAppointment,validateWorkout,toLocalInput,formatDate,dateKey,dayNames,RequestGuard} from './domain.js';
import {deleteMemorySafely} from './operations.js';
import {db,configured,checked,loadData,saveRow,deleteRow,preparePhoto,uploadPhoto,demoData} from './store.js';
import {enablePush,disablePush,pushEnabled,testPush} from './push.js';

const paths={calendar:'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',image:'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 13 5-5 5 5 3-3 5 5M8 7h.01',dumbbell:'m6.5 6.5 11 11M4 9l5-5M2 7l5-5M15 20l5-5M17 22l5-5',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',plus:'M12 5v14M5 12h14',arrow:'M5 12h14m-5-5 5 5-5 5',chevron:'m9 5 7 7-7 7',clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',check:'m5 12 4 4L19 6',edit:'m16 3 5 5-12 12-6 1 1-6L16 3Z',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',close:'m6 6 12 12M6 18 18 6',logout:'M10 4H4v16h6m4-12 4 4-4 4M8 12h13',spark:'m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z',upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',user:'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',lock:'M5 10h14v11H5V10Zm3 0V6a4 4 0 0 1 8 0v4',search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
const flower=`<svg class="flower" viewBox="0 0 100 100" aria-hidden="true"><g fill="currentColor">${Array.from({length:8},(_,i)=>`<ellipse cx="50" cy="27" rx="11" ry="22" transform="rotate(${i*45} 50 50)"/>`).join('')}</g><circle cx="50" cy="50" r="10" fill="#e4c982"/></svg>`;
const categories={pessoal:['Pessoal','heart'],saude:['Autocuidado','spark'],estudo:['Estudos','calendar'],encontro:['A dois','heart'],outro:['Outros','calendar']};
const tabs={compromissos:['Compromissos','calendar','Seu tempo, com mais leveza.'],lembrancas:['Lembranças','image','Alguns momentos merecem ficar.'],treinos:['Treinos','dumbbell','Um carinho por você, a cada movimento.']};
let state={user:null,demo:true,data:demoData(),tab:location.hash.slice(1) in tabs?location.hash.slice(1):'compromissos',filter:'proximos',memoryFilter:'todas',workoutFilter:'todos',calendar:new Date(new Date().getFullYear(),new Date().getMonth(),1),selectedDate:null,notify:false,loading:false,search:''};
let deferredInstall=null, photoPreview=null, demoURLs=[];
const requests=new RequestGuard();
const app=document.querySelector('#app'),dialog=document.querySelector('#editor');
let toastTimer;
function toast(message) {const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),5500);}
function fail(error) {console.error(error?.name||'Operation failed'); const message=error?.message||'Não foi possível concluir. Tente novamente.';toast(/fetch|network/i.test(message)?'Sem conexão no momento. Confira sua internet e tente novamente.':message);}
function empty(type,title,text,action,label) {return `<div class="empty">${icon(type)}<h3>${title}</h3><p>${text}</p>${action?`<button class="btn primary" data-action="${action}">${icon('plus')}${label}</button>`:''}</div>`;}
function headerButton(action,text,ico='plus',cls='primary') {return `<button class="btn ${cls}" data-action="${action}">${icon(ico)}<span>${text}</span></button>`;}
function render() {
  const total=state.data.appointments.filter(a=>!a.completed && dateKey(a.starts_at)===dateKey()).length;
  app.innerHTML=`
    <aside class="sidebar">
      <a href="#compromissos" class="brand" aria-label="Rayza início"><span class="brand-flower">${flower}</span><span>rayza<span class="brand-dot">.</span><small>UM CANTINHO SÓ SEU</small></span></a>
      <div class="nav-label">SEU UNIVERSO</div>
      <nav aria-label="Navegação principal">${Object.entries(tabs).map(([key,[label,ico]])=>`<button class="nav-item ${state.tab===key?'active':''}" data-tab="${key}" ${state.tab===key?'aria-current="page"':''}>${icon(ico)}<span>${label}</span>${key==='compromissos' && total?`<span class="nav-count">${total}</span>`:''}</button>`).join('')}</nav>
      <div class="sidebar-note">${flower}<p>Floresça no<br><em>seu tempo.</em></p><span>O bonito também está<br>nas pequenas coisas.</span></div>
      <div class="sidebar-bottom"><button class="subtle" data-action="settings">${icon('bell')} Lembretes e aplicativo</button><div class="profile"><span class="avatar">R</span><div><strong>${state.demo?'Rayza':e(state.user?.user_metadata?.name||'Rayza')}</strong><small>${state.demo?'Prévia do seu cantinho':'Seu espaço particular'}</small></div><button class="icon-btn" data-action="${state.demo?'auth':'logout'}" aria-label="${state.demo?'Entrar na conta':'Sair da conta'}">${icon(state.demo?'user':'logout')}</button></div></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><span class="breadcrumb">Meu cantinho <span>/</span> <strong>${tabs[state.tab][0]}</strong></span><div class="top-actions"><span class="today">${formatDate(new Date(),{day:'numeric',month:'long'})}</span><button class="icon-btn notification-button ${state.notify?'enabled':''}" data-action="settings" aria-label="Configurar notificações">${icon('bell')}<i></i></button><span class="avatar small">R</span></div></header>
      ${state.demo?`<div class="demo-banner"><span>${icon('spark')} Você está explorando uma prévia. As alterações aqui são temporárias.</span><button data-action="auth">${configured?'Entrar e salvar':'Conectar minha conta'} ${icon('arrow')}</button></div>`:''}
      <main id="main" tabindex="-1">
        <section class="welcome"><div><div class="eyebrow"><span></span> FEITO DE DIAS & PEQUENAS FELICIDADES</div><h1>Que bom ter você aqui, <em>Rayza.</em> <span class="tiny-star">✧</span></h1><p>Um lugar para seus planos, suas histórias e tudo que faz você florescer.</p></div><div class="welcome-art">${flower}<span>com amor, para você</span></div></section>
        ${state.tab==='compromissos'?appointmentsView():state.tab==='lembrancas'?memoriesView():workoutsView()}
        <footer class="page-footer"><span>Feito para guardar o que importa.</span><span>com amor ${icon('heart')} para Rayza</span></footer>
      </main>
      <nav class="mobile-nav" aria-label="Navegação no celular">${Object.entries(tabs).map(([key,[label,ico]])=>`<button data-tab="${key}" class="${state.tab===key?'active':''}" ${state.tab===key?'aria-current="page"':''}>${icon(ico)}<span>${label}</span></button>`).join('')}</nav>
    </div>`;
}
function statsCard(ico,value,label,extra='') {return `<div class="stat-card"><span class="stat-icon ${extra}">${icon(ico)}</span><div><strong>${value}</strong><span>${label}</span></div><span class="stat-decoration">✧</span></div>`;}
function appointmentsView() {
  const upcoming=state.data.appointments.filter(a=>!a.completed && new Date(a.starts_at)>=new Date());
  const done=state.data.appointments.filter(a=>a.completed).length;
  let items=state.data.appointments.filter(a=>state.filter==='concluidos'?a.completed:state.filter==='todos'?true:state.filter==='hoje'?!a.completed && dateKey(a.starts_at)===dateKey():!a.completed);
  if(state.selectedDate) items=items.filter(a=>dateKey(a.starts_at)===state.selectedDate);
  items.sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
  const groups=new Map();for(const a of items){const key=dateKey(a.starts_at);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a);}
  const next=upcoming.sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at))[0];
  return `<div class="stats-grid">${statsCard('calendar',state.data.appointments.filter(a=>!a.completed && dateKey(a.starts_at)===dateKey()).length,'compromissos hoje')}${statsCard('clock',upcoming.length,'planos pela frente','peach')}${statsCard('check',done,'pequenas conquistas','sage')}</div>
    <div class="section-heading"><div><div class="eyebrow">UM DIA DE CADA VEZ</div><h2>Seus compromissos<span>.</span></h2><p>Deixe os planos por aqui. O carinho, a gente lembra.</p></div>${headerButton('new-appointment','Novo compromisso')}</div>
    <div class="agenda-layout"><section class="panel agenda-panel" aria-label="Lista de compromissos"><div class="filters" role="group" aria-label="Filtrar compromissos">${[['proximos','Pendentes'],['hoje','Hoje'],['concluidos','Concluídos'],['todos','Todos']].map(([key,label])=>`<button class="filter ${state.filter===key?'active':''}" data-filter="${key}">${label}</button>`).join('')}</div>
    ${state.selectedDate?`<div class="date-selection">${formatDate(`${state.selectedDate}T12:00:00`,{day:'numeric',month:'long'})}<button data-action="clear-date">Limpar filtro ${icon('close')}</button></div>`:''}
    <div class="agenda-list">${state.loading?'<div class="loading">Buscando seus planos…</div>':items.length?[...groups].map(([date,rows])=>`<div class="date-group"><div class="date-label">${date===dateKey()?'HOJE':date===dateKey(new Date(Date.now()+86400000))?'AMANHÃ':formatDate(`${date}T12:00:00`,{weekday:'long'}).toUpperCase()}<span>${formatDate(`${date}T12:00:00`,{day:'numeric',month:'long'})}</span></div>${rows.map(appointmentCard).join('')}</div>`).join(''):empty('calendar','Espaço para novos planos','Um café, um encontro ou um tempo só seu. O próximo momento começa aqui.','new-appointment','Criar compromisso')}</div><div class="panel-foot">${icon('heart')} A vida fica mais leve quando cada coisa tem seu tempo.</div></section>
    <aside class="agenda-aside">${calendarView()}<div class="reminder-card"><span class="mini-icon">${icon('bell')}</span><span class="tag">UM CUIDADO A MAIS</span><h3>Seus planos.<br>Um lembrete com carinho.</h3><p>${state.notify?'Este aparelho está inscrito para receber os seus lembretes.':'Ative os avisos para receber um lembrete dos seus compromissos.'}</p><button data-action="settings">${state.notify?'Gerenciar lembretes':'Ativar notificações'} ${icon('arrow')}</button><span class="reminder-spark">✧</span></div>${next?`<div class="next-card"><div class="eyebrow">O PRÓXIMO CAPÍTULO</div><p>${e(next.title)}</p><span>${formatDate(next.starts_at,{day:'numeric',month:'short'})} · ${formatDate(next.starts_at,{hour:'2-digit',minute:'2-digit'})}</span></div>`:''}</aside></div>`;
}
function appointmentCard(a) {
  const category=categories[a.category]||categories.pessoal, past=new Date(a.starts_at)<new Date()&&!a.completed;
  return `<article class="appointment ${a.completed?'completed':''}"><button class="completion" data-action="toggle-appointment" data-id="${a.id}" aria-label="${a.completed?'Reabrir':'Concluir'} ${e(a.title)}">${a.completed?icon('check'):''}</button><span class="appointment-icon ${a.category}">${icon(category[1])}</span><div class="appointment-content"><div class="appointment-top"><h3>${e(a.title)}</h3><span class="category ${a.category}">${category[0]}</span></div><div class="appointment-meta"><span>${icon('clock')}${formatDate(a.starts_at,{hour:'2-digit',minute:'2-digit'})}</span>${a.location?`<span>${icon('pin')}${e(a.location)}</span>`:''}${past?'<span class="past-label">Horário passado</span>':''}</div>${a.notes?`<p class="appointment-note">${e(a.notes)}</p>`:''}<div class="reminder-label">${icon('bell')}${a.reminder_minutes===0?'No horário':a.reminder_minutes===1440?'1 dia antes':`${a.reminder_minutes} min antes`}</div></div><div class="card-actions"><button class="icon-btn" data-action="edit-appointment" data-id="${a.id}" aria-label="Editar ${e(a.title)}">${icon('edit')}</button><button class="icon-btn danger" data-action="delete-appointment" data-id="${a.id}" aria-label="Excluir ${e(a.title)}">${icon('trash')}</button></div></article>`;
}
function calendarView() {
  const y=state.calendar.getFullYear(),m=state.calendar.getMonth(),offset=(new Date(y,m,1).getDay()+6)%7,count=new Date(y,m+1,0).getDate();
  const dates=new Set(state.data.appointments.filter(a=>!a.completed).map(a=>dateKey(a.starts_at)));
  return `<section class="panel calendar"><div class="calendar-heading"><h3>${formatDate(state.calendar,{month:'long',year:'numeric'})}</h3><div><button class="icon-btn rotate" data-action="prev-month" aria-label="Mês anterior">${icon('chevron')}</button><button class="icon-btn" data-action="next-month" aria-label="Próximo mês">${icon('chevron')}</button></div></div><div class="calendar-grid">${['S','T','Q','Q','S','S','D'].map(d=>`<span class="week-label">${d}</span>`).join('')}${Array.from({length:offset},()=>'<span></span>').join('')}${Array.from({length:count},(_,i)=>{const key=dateKey(new Date(y,m,i+1));return `<button data-date="${key}" class="calendar-day ${key===dateKey()?'today-date':''} ${key===state.selectedDate?'selected':''} ${dates.has(key)?'has-plan':''}" aria-label="${i+1} de ${formatDate(state.calendar,{month:'long'})}${dates.has(key)?', com compromissos':''}">${i+1}</button>`;}).join('')}</div><div class="calendar-legend"><i></i> Um plano para esse dia <button data-action="calendar-today">Hoje</button></div></section>`;
}
function memoriesView() {
  let items=state.data.memories.filter(m=>state.memoryFilter==='favoritas'?m.favorite:true).filter(m=>`${m.title} ${m.caption}`.toLocaleLowerCase('pt-BR').includes(state.search.toLocaleLowerCase('pt-BR'))).sort((a,b)=>b.taken_on.localeCompare(a.taken_on));
  return `<div class="memory-intro"><div class="eyebrow">UM ÁLBUM DE PEQUENAS ETERNIDADES</div><h2>O que o coração <em>guarda.</em></h2><p>Fotos, histórias e pedacinhos de vida que merecem um lugar especial.</p><span class="memory-flower">${flower}</span></div><div class="section-heading gallery-heading"><div class="filters" role="group" aria-label="Filtrar lembranças"><button class="filter ${state.memoryFilter==='todas'?'active':''}" data-memory-filter="todas">Todas <span>${state.data.memories.length}</span></button><button class="filter ${state.memoryFilter==='favoritas'?'active':''}" data-memory-filter="favoritas">${icon('heart')} Favoritas</button></div>${headerButton('new-memory','Guardar lembrança')}</div><div class="gallery-tools"><span>${state.demo?'Ilustrações de exemplo · suas fotos vão morar aqui':'Um instante passa. Uma lembrança fica.'}</span><label class="search">${icon('search')}<input id="memory-search" placeholder="Buscar uma lembrança" value="${e(state.search)}" aria-label="Buscar lembranças" /></label></div><section class="gallery" aria-label="Galeria de lembranças">${items.length?items.map((m,i)=>`<article class="memory-card"><div class="memory-image"><button class="photo-open" data-action="view-memory" data-id="${m.id}" aria-label="Ver ${e(m.title)}">${m.url?`<img src="${e(m.url)}" alt="${e(m.title)}" loading="lazy" />`:`<div class="photo-missing">${icon('image')}<span>Foto indisponível. Atualize a página.</span></div>`}</button><button class="favorite ${m.favorite?'is-favorite':''}" data-action="favorite-memory" data-id="${m.id}" aria-label="${m.favorite?'Remover dos':'Adicionar aos'} favoritos" aria-pressed="${m.favorite}">${icon('heart')}</button><span class="photo-number">NO. ${String(i+1).padStart(2,'0')}</span></div><div class="memory-caption"><span>${formatDate(`${m.taken_on}T12:00:00`,{day:'2-digit',month:'long',year:'numeric'})}</span><h3>${e(m.title)}</h3><p>${e(m.caption)}</p><div class="memory-actions"><button class="text-button" data-action="edit-memory" data-id="${m.id}">${icon('edit')}Editar</button><button class="icon-btn danger" data-action="delete-memory" data-id="${m.id}" aria-label="Excluir ${e(m.title)}">${icon('trash')}</button></div></div></article>`).join(''):empty('image',state.search?'Nenhuma lembrança encontrada':'Toda história começa com um instante',state.search?'Tente buscar por outro nome.':'Guarde a primeira foto e deixe esse cantinho com a sua cara.','new-memory','Adicionar primeira foto')}</section><div class="gallery-quote">“Que a gente nunca perca a vontade de criar boas lembranças.” <span>♡</span></div>`;
}
function workoutsView() {
  const today=new Date().getDay(),weekStart=new Date();weekStart.setDate(weekStart.getDate()-(weekStart.getDay()+6)%7);
  const total=state.data.logs.filter(l=>l.done_on>=dateKey(weekStart)&&l.done_on<=dateKey()).length;
  const items=state.data.workouts.filter(w=>state.workoutFilter==='hoje'?w.days.includes(today):true);
  return `<section class="workout-hero"><div><div class="eyebrow">SEU CORPO, SEU RITMO</div><h2>Forte, leve e<br><em>cada vez mais você.</em></h2><p>Organize seus treinos e celebre cada vez que você escolhe se cuidar.</p><span class="workout-badge">${icon('heart')} Constância é um gesto de amor-próprio.</span></div><div class="workout-art">${icon('dumbbell')}<span>um passo<br><em>de cada vez</em></span><i>✧</i></div></section><div class="stats-grid">${statsCard('dumbbell',state.data.workouts.length,'treinos na sua rotina')}${statsCard('calendar',state.data.workouts.filter(w=>w.days.includes(today)).length,'treinos para hoje','peach')}${statsCard('check',total,'concluídos nesta semana','sage')}</div><div class="section-heading"><div><div class="eyebrow">RESERVE UM TEMPO PARA VOCÊ</div><h2>Minha rotina<span>.</span></h2><p>Seus exercícios, organizados do seu jeito.</p></div>${headerButton('new-workout','Criar treino')}</div><div class="routine-toolbar"><div class="filters"><button class="filter ${state.workoutFilter==='todos'?'active':''}" data-workout-filter="todos">Todos os treinos</button><button class="filter ${state.workoutFilter==='hoje'?'active':''}" data-workout-filter="hoje">Para hoje</button></div><span>Hoje é ${formatDate(new Date(),{weekday:'long'})}</span></div><section class="workouts-grid" aria-label="Seus treinos">${items.length?items.map(workoutCard).join(''):empty('dumbbell','Sua rotina começa com você','Adicione os exercícios do seu treino, as séries e os dias. Tudo pode ser ajustado depois.','new-workout','Montar meu treino')}</section><div class="gentle-note">${icon('spark')} O descanso também faz parte. Registre aqui os treinos orientados pelo seu profissional.</div>`;
}
function workoutCard(w) {
  const done=state.data.logs.some(l=>l.workout_id===w.id && l.done_on===dateKey());
  return `<article class="workout-card ${done?'workout-done':''}"><div class="workout-card-top"><span class="stat-icon">${icon('dumbbell')}</span><span>${icon('clock')}${w.duration} min</span><div class="card-actions"><button class="icon-btn" data-action="edit-workout" data-id="${w.id}" aria-label="Editar ${e(w.title)}">${icon('edit')}</button><button class="icon-btn danger" data-action="delete-workout" data-id="${w.id}" aria-label="Excluir ${e(w.title)}">${icon('trash')}</button></div></div><span class="eyebrow">${e(w.focus||'MEU TEMPO DE CUIDADO')}</span><h3>${e(w.title)}</h3><div class="day-chips">${dayNames.map((name,i)=>`<span class="${w.days.includes(i)?'chosen':''}">${name}</span>`).join('')}</div><div class="exercise-summary"><span>${w.exercises.length} exercícios</span><span>Séries × rep.</span></div>${w.invalidExercises?`<p class="form-error">Alguns exerc?cios precisam ser revisados. Edite o treino para ajustar.</p>`:""}<ol class="exercise-list">${w.exercises.map((x,i)=>`<li><span class="exercise-index">${String(i+1).padStart(2,'0')}</span><div><strong>${e(x.name)}</strong><small>${e(x.weight||'Sem carga definida')} · ${e(x.rest)}s descanso</small></div><b>${x.sets} × ${e(x.reps)}</b></li>`).join('')}</ol>${w.notes?`<p class="workout-notes">${e(w.notes)}</p>`:''}<button class="btn ${done?'soft':'primary'} full" data-action="log-workout" data-id="${w.id}">${icon('check')}${done?'Feito hoje! Desfazer':'Marcar treino de hoje como feito'}</button></article>`;
}

function closeDialog() {dialog.close();if(photoPreview){URL.revokeObjectURL(photoPreview);photoPreview=null;}dialog.innerHTML='';}
function openDialog(content,wide=false) {dialog.innerHTML=content;dialog.className=wide?'wide':'';if(!dialog.open) dialog.showModal();}
function dialogHead(kicker,title) {return `<div class="dialog-heading"><div><span class="eyebrow">${kicker}</span><h2 id="dialog-title">${title}</h2></div><button class="icon-btn" type="button" data-action="close" aria-label="Fechar">${icon('close')}</button></div>`;}
const field=(label,name,value='',type='text',extra='')=>`<label class="field"><span>${label}</span><input type="${type}" name="${name}" value="${e(value)}" ${extra} /></label>`;
const textarea=(label,name,value='',max=2000)=>`<label class="field"><span>${label}</span><textarea name="${name}" rows="3" maxlength="${max}">${e(value)}</textarea></label>`;
function formFoot(label='Salvar com carinho') {return `<p class="form-error" role="alert"></p><div class="form-foot"><button type="button" class="btn ghost" data-action="close">Cancelar</button><button class="btn primary" type="submit">${icon('check')}${label}</button></div>`;}
function appointmentForm(id) {
  const a=state.data.appointments.find(a=>a.id===id)||{starts_at:toLocalInput(new Date(Date.now()+3600000)),reminder_minutes:15,category:'pessoal'};
  openDialog(`${dialogHead('UM NOVO MOMENTO',id?'Editar compromisso':'Vamos fazer um plano?')}<form data-form="appointment" data-id="${id||''}">${field('O que vamos lembrar?','title',a.title,'text','required maxlength="120" placeholder="Ex.: Nosso jantar de sexta"')}<div class="form-grid">${field('Data e hora','starts_at',toLocalInput(a.starts_at),'datetime-local','required')}<label class="field"><span>Categoria</span><select name="category">${Object.entries(categories).map(([k,[v]])=>`<option value="${k}" ${a.category===k?'selected':''}>${v}</option>`).join('')}</select></label></div>${field('Onde? (opcional)','location',a.location,'text','maxlength="200" placeholder="Um lugar especial"')}<label class="field"><span>${icon('bell')} Quando você quer ser lembrada?</span><select name="reminder_minutes">${[[0,'No horário'],[5,'5 minutos antes'],[15,'15 minutos antes'],[30,'30 minutos antes'],[60,'1 hora antes'],[1440,'1 dia antes']].map(([n,t])=>`<option value="${n}" ${a.reminder_minutes===n?'selected':''}>${t}</option>`).join('')}</select></label>${textarea('Um detalhe para não esquecer (opcional)','notes',a.notes)}<p class="form-hint">${icon('bell')}${state.demo?'Na prévia, não há envio de notificações.':'Para receber com o site fechado, ative as notificações neste aparelho.'}</p>${formFoot()}</form>`);
}
function memoryForm(id) {
  const m=state.data.memories.find(m=>m.id===id)||{taken_on:dateKey()};
  openDialog(`${dialogHead('PEDACINHOS DE FELICIDADE',id?'Editar lembrança':'Guarde esse instante.')}<form data-form="memory" data-id="${id||''}"><label class="upload-zone"><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" ${id?'':'required'} /><span id="photo-preview">${m.url?`<img src="${e(m.url)}" alt="Prévia da lembrança" />`:`${icon('upload')}<strong>Escolha uma foto especial</strong><small>JPG, PNG ou WebP · até 20 MB</small>`}</span><span class="upload-change">${id?'Escolher outra foto':'Toque para escolher uma foto'}</span></label>${field('Um nome para essa lembrança','title',m.title,'text','required maxlength="120" placeholder="Ex.: O melhor pôr do sol"')}${field('Quando aconteceu?','taken_on',m.taken_on,'date','required')}${textarea('A história por trás da foto (opcional)','caption',m.caption,1000)}${formFoot('Guardar lembrança')}</form>`);
}
function exerciseRow(x={name:'',sets:3,reps:'12',weight:'',rest:60}) {
  return `<fieldset class="exercise-editor"><legend>Exercício</legend><div class="exercise-row-heading"><span>${icon('dumbbell')} Seu próximo movimento</span><button class="icon-btn danger" type="button" data-action="remove-exercise" aria-label="Remover exercício">${icon('trash')}</button></div>${field('Nome do exercício','exercise_name',x.name,'text','required maxlength="100" placeholder="Ex.: Nome do exercício"')}<div class="exercise-fields">${field('Séries','sets',x.sets,'number','required min="1" max="100"')}${field('Repetições','reps',x.reps,'text','required maxlength="30" placeholder="12 ou 30s"')}${field('Carga','weight',x.weight,'text','maxlength="40" placeholder="Ex.: 5 kg"')}${field('Descanso (s)','rest',x.rest,'number','required min="0" max="3600"')}</div></fieldset>`;
}
function workoutForm(id) {
  const w=state.data.workouts.find(w=>w.id===id)||{days:[],duration:45,exercises:[{name:'',sets:3,reps:'12',weight:'',rest:60}]};
  openDialog(`${dialogHead('UM TEMPO PARA VOCÊ',id?'Ajustar meu treino':'Monte sua rotina.')}<form data-form="workout" data-id="${id||''}">${field('Nome do treino','title',w.title,'text','required maxlength="100" placeholder="Ex.: Treino A — inferiores"')}<div class="form-grid">${field('Foco (opcional)','focus',w.focus,'text','maxlength="100" placeholder="Ex.: Mobilidade"')}${field('Duração estimada (min)','duration',w.duration,'number','required min="1" max="360"')}</div><fieldset class="day-picker"><legend>Em quais dias?</legend>${dayNames.map((name,i)=>`<label><input type="checkbox" name="days" value="${i}" ${w.days.includes(i)?'checked':''}/><span>${name}</span></label>`).join('')}</fieldset><div id="exercise-editors">${w.exercises.map(exerciseRow).join('')}</div><button type="button" class="btn soft full" data-action="add-exercise">${icon('plus')}Adicionar exercício</button>${textarea('Observações (opcional)','notes',w.notes)}${formFoot('Salvar meu treino')}</form>`,true);
}
function authForm(mode='login') {
  if(!configured) {
    openDialog(`${dialogHead('SEU CANTINHO ESTÁ QUASE PRONTO','Só falta conectar.')}<div class="setup-note">${icon('lock')}<p>O visual já está pronto para explorar. Para salvar suas fotos, compromissos e treinos, o responsável pelo site precisa conectar o Supabase.</p><p>O passo a passo está no arquivo <strong>README.md</strong> do repositório, junto com as configurações da Vercel.</p><p>Esta prévia é temporária: nada daqui é enviado para um banco de dados.</p></div><button class="btn primary full" data-action="close">Continuar explorando</button>`);return;
  }
  const signup=mode==='signup',reset=mode==='reset',update=mode==='update';
  openDialog(`${dialogHead('BEM-VINDA AO SEU CANTINHO',signup?'Comece sua história.':reset?'Vamos recuperar seu acesso.':update?'Sua nova senha.':'Entre e fique à vontade.')}<form data-form="auth" data-mode="${mode}">${signup?field('Como podemos chamar você?','name','Rayza','text','required maxlength="50" autocomplete="given-name"'):''}${!update?field('Seu e-mail','email','','email','required autocomplete="email"'):''}${!reset?field(signup||update?'Escolha uma senha (mínimo 8 caracteres)':'Sua senha','password','','password',`required minlength="8" maxlength="128" autocomplete="${signup||update?'new-password':'current-password'}"`):''}<p class="form-error" role="alert"></p><button class="btn primary full" type="submit">${icon('heart')}${signup?'Criar minha conta':reset?'Enviar link de recuperação':update?'Salvar nova senha':'Entrar no meu cantinho'}</button>${mode==='login'?'<button class="text-button centered" type="button" data-auth-mode="reset">Esqueci minha senha</button>':''}${!update?`<p class="auth-switch">${signup?'Já tem uma conta?':'Primeira vez aqui?'} <button type="button" data-auth-mode="${signup?'login':'signup'}">${signup?'Entrar':'Criar conta'}</button></p>`:''}</form>`);
}
function settings() {
  const supported='PushManager' in window;
  openDialog(`${dialogHead('SEMPRE POR PERTO','Um lembrete de carinho.')}<div class="settings-intro">${icon('bell')}<p>Receba os lembretes dos seus compromissos mesmo quando a página estiver fechada.</p></div><div class="settings-status"><i class="${state.notify?'on':''}"></i><div><strong>${state.notify?'Ativadas neste aparelho':'Notificações não ativadas'}</strong><small>${state.demo?'Entre na conta para vincular seus lembretes.':supported?'A permissão é individual para cada aparelho.':'Use um navegador compatível e atualizado.'}</small></div></div><p class="form-error" role="alert"></p><div class="settings-buttons">${state.notify?`${headerButton('test-push','Testar neste aparelho','bell')}${headerButton('disable-push','Desativar neste aparelho','close','ghost')}`:headerButton('enable-push',state.demo?'Entrar para ativar':'Ativar neste aparelho','bell')}</div><div class="install-card"><h3>${icon('download')} Leve seu cantinho com você</h3><p><strong>iPhone:</strong> abra no Safari → Compartilhar → Adicionar à Tela de Início. Abra pelo ícone e ative as notificações (iOS 16.4 ou superior).</p><p><strong>Android/computador:</strong> use a opção “Instalar aplicativo” do navegador.</p>${deferredInstall?headerButton('install','Instalar Rayza','download','soft'):''}</div><p class="form-hint">O aparelho precisa estar conectado. Economia de bateria, modo foco e permissões podem atrasar os avisos. O envio depende de o servidor e o agendador estarem configurados.</p>`);
}
function confirmDelete(type,id) {
  const names={appointment:'este compromisso',memory:'esta lembrança e sua foto',workout:'este treino e seu histórico'};
  openDialog(`${dialogHead('ABRIR ESPAÇO','Quer mesmo excluir?')}<p class="confirm-copy">Você vai excluir ${names[type]}. Essa ação não pode ser desfeita.</p><form data-form="delete" data-type="${type}" data-id="${id}"><p class="form-error" role="alert"></p><div class="form-foot"><button type="button" class="btn ghost" data-action="close">Quero manter</button><button type="submit" class="btn destructive">${icon('trash')}Sim, excluir</button></div></form>`);
}
async function persist(table,row,id) {
  requests.invalidate();state.loading=false;
  const user=state.user,demo=state.demo;
  const names={appointments:'appointments',memories:'memories',workouts:'workouts',workout_logs:'logs'};
  const bucket=state.data[names[table]];
  const saved=demo?{...row,id:id||crypto.randomUUID()}:await saveRow(table,row,user,id);
  if(state.user?.id!==user?.id || state.demo!==demo) throw Error('A sessão mudou. Entre novamente.');
  requests.invalidate();
  const index=bucket.findIndex(x=>x.id===saved.id);if(index>=0) bucket[index]={...bucket[index],...saved};else bucket.push(saved);
  return saved;
}
async function remove(table,id) {
  requests.invalidate();state.loading=false;
  const user=state.user,demo=state.demo;
  if(!demo) await deleteRow(table,id,user);
  if(state.user?.id!==user?.id || state.demo!==demo) throw Error('A sessão mudou. Entre novamente.');
  requests.invalidate();
  const key=table==='workout_logs'?'logs':table;state.data[key]=state.data[key].filter(x=>x.id!==id);
}
async function refresh() {
  if(!state.user) return;
  const user=state.user,request=requests.begin(user.id);
  state.loading=true;render();
  try {
    const [data,notify]=await Promise.all([loadData(user),pushEnabled(user)]);
    if(requests.current(request,state.user?.id)){state.data=data;state.notify=notify;}
  } finally {if(requests.current(request,state.user?.id)){state.loading=false;render();}}
}
async function action(name,id,button) {
  if(name==='close') return closeDialog();
  if(name==='new-appointment'||name==='edit-appointment') return appointmentForm(id);
  if(name==='new-memory'||name==='edit-memory') return memoryForm(id);
  if(name==='new-workout'||name==='edit-workout') return workoutForm(id);
  if(name.startsWith('delete-')) return confirmDelete(name.slice(7),id);
  if(name==='auth') return authForm();
  if(name==='settings') return settings();
  if(name==='clear-date'){state.selectedDate=null;return render();}
  if(name==='prev-month'||name==='next-month'){state.calendar=new Date(state.calendar.getFullYear(),state.calendar.getMonth()+(name==='next-month'?1:-1),1);return render();}
  if(name==='calendar-today'){state.calendar=new Date(new Date().getFullYear(),new Date().getMonth(),1);state.selectedDate=null;return render();}
  if(name==='add-exercise'){if(dialog.querySelectorAll('.exercise-editor').length>=30) return toast('Você pode colocar até 30 exercícios por treino.');dialog.querySelector('#exercise-editors').insertAdjacentHTML('beforeend',exerciseRow());return;}
  if(name==='remove-exercise'){button.closest('.exercise-editor').remove();return;}
  if(name==='view-memory') {
    const m=state.data.memories.find(m=>m.id===id);
    return openDialog(`${dialogHead('UM INSTANTE PARA REVER',e(m.title))}<div class="lightbox">${m.url?`<img src="${e(m.url)}" alt="${e(m.title)}"/>`:''}<p>${e(m.caption)}</p><span>${formatDate(`${m.taken_on}T12:00:00`,{day:'numeric',month:'long',year:'numeric'})}</span></div>`,true);
  }
  if(name==='toggle-appointment'){const a=state.data.appointments.find(a=>a.id===id);await persist('appointments',{completed:!a.completed},id);render();return toast(a.completed?'Compromisso reaberto.':'Mais uma pequena conquista. 💜');}
  if(name==='favorite-memory'){const m=state.data.memories.find(m=>m.id===id);await persist('memories',{favorite:!m.favorite},id);render();return;}
  if(name==='log-workout') {
    const log=state.data.logs.find(l=>l.workout_id===id && l.done_on===dateKey());
    if(log) await remove('workout_logs',log.id);else await persist('workout_logs',{workout_id:id,done_on:dateKey()});
    render();return toast(log?'Registro de hoje desfeito.':'Você fez algo por você hoje. Que orgulho! 💜');
  }
  if(name==='enable-push'){if(state.demo)return authForm();await enablePush(state.user);state.notify=true;render();settings();return toast('Este aparelho foi inscrito para receber lembretes. 💜');}
  if(name==='disable-push'){await disablePush(state.user);state.notify=false;render();return settings();}
  if(name==='test-push'){await testPush();return toast('Aviso de teste exibido neste aparelho.');}
  if(name==='logout') {
    requests.invalidate();
    await disablePush(state.user);await checked(db.auth.signOut());state.user=null;state.demo=true;state.notify=false;state.data=demoData();render();toast('Você saiu. Os lembretes deste aparelho foram desativados.');return;
  }
  if(name==='install' && deferredInstall){await deferredInstall.prompt();deferredInstall=null;settings();}
}
document.addEventListener('click',async event=> {
  const tab=event.target.closest('[data-tab]');if(tab){state.tab=tab.dataset.tab;history.replaceState(null,'',`#${state.tab}`);render();return;}
  const filter=event.target.closest('[data-filter]');if(filter){state.filter=filter.dataset.filter;render();return;}
  const memoryFilter=event.target.closest('[data-memory-filter]');if(memoryFilter){state.memoryFilter=memoryFilter.dataset.memoryFilter;render();return;}
  const workoutFilter=event.target.closest('[data-workout-filter]');if(workoutFilter){state.workoutFilter=workoutFilter.dataset.workoutFilter;render();return;}
  const day=event.target.closest('[data-date]');if(day){state.selectedDate=day.dataset.date;state.filter='todos';render();return;}
  const auth=event.target.closest('[data-auth-mode]');if(auth){authForm(auth.dataset.authMode);return;}
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  button.disabled=true;
  try {await action(button.dataset.action,button.dataset.id,button);} catch(error) {const alert=dialog.open&&dialog.querySelector('.form-error');if(alert) alert.textContent=error.message;else fail(error);} finally {button.disabled=false;}
});
document.addEventListener('input',event=> {
  if(event.target.id==='memory-search') {const position=event.target.selectionStart;state.search=event.target.value;render();const input=document.querySelector('#memory-search');input.focus();input.setSelectionRange(position,position);}
});
dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
dialog.addEventListener('change',event=> {
  if(event.target.name==='photo' && event.target.files[0]) {
    if(photoPreview)URL.revokeObjectURL(photoPreview);photoPreview=URL.createObjectURL(event.target.files[0]);
    const preview=dialog.querySelector('#photo-preview');preview.replaceChildren();const image=new Image();image.alt='Prévia da foto escolhida';image.src=photoPreview;preview.append(image);
  }
});
dialog.addEventListener('submit',async event=> {
  event.preventDefault();const form=event.target,kind=form.dataset.form,id=form.dataset.id,fd=new FormData(form),button=form.querySelector('[type="submit"]'),errorBox=form.querySelector('.form-error');
  if(button.disabled)return;button.disabled=true;const original=button.innerHTML;button.textContent='Salvando…';errorBox.textContent='';
  try {
    if(kind==='appointment') {
      const row={title:fd.get('title').trim(),starts_at:new Date(fd.get('starts_at')).toISOString(),category:fd.get('category'),location:fd.get('location').trim(),notes:fd.get('notes').trim(),reminder_minutes:Number(fd.get('reminder_minutes'))};
      validateAppointment(row);await persist('appointments',row,id);toast('Compromisso guardado com carinho. 💜');
    } else if(kind==='memory') {
      const file=fd.get('photo'),old=state.data.memories.find(m=>m.id===id);
      const row={title:fd.get('title').trim(),taken_on:fd.get('taken_on'),caption:fd.get('caption').trim()};
      if(file?.size) {
        const blob=await preparePhoto(file);
        if(state.demo) {row.url=URL.createObjectURL(blob);demoURLs.push(row.url);}
        else {
          const uploaded=await uploadPhoto(blob,state.user);row.photo_path=uploaded;
          try {await persist('memories',row,id);} catch(error) {await db.storage.from('memories').remove([uploaded]);throw error;}
          if(old?.photo_path) {const cleanup=await db.storage.from('memories').remove([old.photo_path]);if(cleanup.error)toast('Nova foto salva. A anterior não pôde ser removida do armazenamento.');}
          await refresh();closeDialog();return toast('Um instante bonito, guardado. 💜');
        }
      } else if(!id) throw Error('Escolha uma foto para sua lembrança.');
      await persist('memories',row,id);toast('Um instante bonito, guardado. 💜');
    } else if(kind==='workout') {
      const row={title:fd.get('title').trim(),focus:fd.get('focus').trim(),duration:Number(fd.get('duration')),days:fd.getAll('days').map(Number),notes:fd.get('notes').trim(),exercises:[...form.querySelectorAll('.exercise-editor')].map(node=>({name:node.querySelector('[name="exercise_name"]').value.trim(),sets:Number(node.querySelector('[name="sets"]').value),reps:node.querySelector('[name="reps"]').value.trim(),weight:node.querySelector('[name="weight"]').value.trim(),rest:Number(node.querySelector('[name="rest"]').value)}))};
      validateWorkout(row);await persist('workouts',row,id);toast('Seu treino já tem um lugar por aqui. 💜');
    } else if(kind==='delete') {
      const type=form.dataset.type,table={appointment:'appointments',memory:'memories',workout:'workouts'}[type];
      const row=state.data[table].find(x=>x.id===id);
      let cleanupFailed=false;
      if(type==='memory'&&!state.demo&&row.photo_path) {
        ({cleanupFailed}=await deleteMemorySafely(()=>remove(table,id),()=>checked(db.storage.from('memories').remove([row.photo_path]))));
      } else await remove(table,id);
      if(type==='workout')state.data.logs=state.data.logs.filter(l=>l.workout_id!==id);
      toast(cleanupFailed?'Lembrança removida. Um arquivo privado ficou pendente de limpeza no armazenamento.':'Excluído. Espaço para novas histórias.');
    } else if(kind==='auth') {await submitAuth(form,fd);return;}
    closeDialog();render();
  } catch(error) {errorBox.textContent=translateError(error.message);}
  finally {button.disabled=false;button.innerHTML=original;}
});
function translateError(message='') {
  if(/Invalid login credentials/i.test(message))return 'E-mail ou senha incorretos. Confira e tente novamente.';
  if(/Email not confirmed/i.test(message))return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if(/already registered/i.test(message))return 'Este e-mail já tem uma conta. Entre ou recupere sua senha.';
  if(/rate limit/i.test(message))return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos.';
  if(/fetch|network/i.test(message))return 'Confira sua conexão e tente novamente.';
  if(/row-level|relation .* does not exist|schema cache/i.test(message))return 'O banco ainda precisa ser configurado pelo responsável pelo site.';
  return message||'Não foi possível salvar. Tente novamente.';
}
async function submitAuth(form,fd) {
  const mode=form.dataset.mode,email=fd.get('email'),password=fd.get('password');
  if(mode==='signup') {
    const {data,error}=await db.auth.signUp({email,password,options:{data:{name:fd.get('name')},emailRedirectTo:location.origin}});if(error)throw error;
    if(data.session){await startSession(data.session);closeDialog();return toast('Bem-vinda ao seu cantinho. 💜');}
    openDialog(`${dialogHead('SÓ MAIS UM CARINHO','Confira seu e-mail.')}<p class="confirm-copy">Enviamos um link para confirmar sua conta. Abra sua caixa de entrada (e o spam), confirme e volte para entrar.</p><button class="btn primary full" data-auth-mode="login">Ir para o login</button>`);
  } else if(mode==='reset') {
    await checked(db.auth.resetPasswordForEmail(email,{redirectTo:location.origin}));
    openDialog(`${dialogHead('ESTAMOS POR AQUI','Confira sua caixa de entrada.')}<p class="confirm-copy">Se houver uma conta com esse e-mail, você receberá um link para escolher uma nova senha.</p><button class="btn primary full" data-action="close">Entendi</button>`);
  } else if(mode==='update') {await checked(db.auth.updateUser({password}));closeDialog();toast('Nova senha salva. 💜');}
  else {const data=await checked(db.auth.signInWithPassword({email,password}));await startSession(data.session);closeDialog();toast('Seu cantinho estava com saudade. 💜');}
}
async function startSession(session) {
  requests.invalidate();
  for(const url of demoURLs)URL.revokeObjectURL(url);demoURLs=[];
  state.user=session.user;state.demo=false;state.data={appointments:[],memories:[],workouts:[],logs:[]};await refresh();
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;});
window.addEventListener('hashchange',()=>{if(location.hash.slice(1) in tabs){state.tab=location.hash.slice(1);render();}});
window.addEventListener('online',()=>{if(state.user)refresh().catch(fail);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.user&&!dialog.open)refresh().catch(fail);});
// Atualizar URLs assinadas antes de expirarem; não é um timer de notificações.
setInterval(()=>{if(state.user && !dialog.open && document.visibilityState==='visible')refresh().catch(fail);},45*60*1000);
render();
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
if(db) {
  db.auth.onAuthStateChange((event,session)=> {
    if(event==='PASSWORD_RECOVERY')setTimeout(()=>authForm('update'),0);
    if(event==='SIGNED_OUT' && state.user){requests.invalidate();state.loading=false;state.user=null;state.demo=true;state.notify=false;state.data=demoData();render();}
    if(event==='TOKEN_REFRESHED'&&session)state.user=session.user;
  });
  db.auth.getSession().then(async({data,error})=>{if(error)throw error;if(data.session)await startSession(data.session);else if(!location.hash.includes('type=recovery'))authForm();}).catch(fail);
}

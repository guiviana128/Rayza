import {escapeHTML} from './domain.js';
export function authView({configured,initializing,notice,icon,flower,field,username}) {
  const login=initializing?'<p class="loading">Conferindo sua conexão…</p>':`
    <form data-form="auth" data-mode="login">
      ${field('Usuário','username',username||'rayza.huang','text','required readonly autocomplete="username"')}
      ${field('Sua senha','password','','password','required maxlength="128" autocomplete="current-password"')}
      <p class="form-error" role="alert"></p>
      <button class="btn primary full" type="submit">${icon('heart')}Entrar no meu cantinho</button>
    </form>
    ${!configured?'<div class="connection-required" role="status"><p>O acesso é exclusivo da Rayza. A conexão com o banco ainda precisa ser concluída pelo responsável pelo site.</p></div>':''}`;
  return `<main class="auth-page" id="main">
    <section class="auth-story">
      <a class="auth-brand" href="/">${flower}<span>rayza.</span></a>
      <div class="auth-story-copy"><span class="eyebrow">UM CANTINHO SÓ SEU</span><h1>Seus dias.<br>Suas histórias.<br><em>Do seu jeitinho.</em></h1><p>Um espaço para organizar seus planos, guardar lembranças e cuidar de você.</p><div class="auth-features"><span>${icon('calendar')} Seus compromissos</span><span>${icon('image')} Suas lembranças</span><span>${icon('dumbbell')} Seus treinos</span></div></div>
      <span class="auth-love">com amor, para Rayza ♡</span><div class="auth-petal">${flower}</div>
    </section>
    <section class="auth-panel"><div class="auth-card">
      <span class="eyebrow">SEU ACESSO EXCLUSIVO</span><h2>Que bom ter você aqui.</h2>
      <p class="auth-description">Use seu acesso no celular e no computador. Seus compromissos, fotos e treinos ficam salvos no seu espaço particular.</p>
      ${notice?`<div class="auth-notice" role="status">${escapeHTML(notice)}</div>`:''}
      ${login}
      <div class="auth-private">${icon('lock')} Um cantinho exclusivo para você.</div>
    </div></section>
  </main>`;
}

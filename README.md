# Rayza 💜

Um cantinho em roxo e lilás para organizar a vida, guardar boas histórias e cuidar de si. Feito com **HTML, CSS e JavaScript**, pronto para hospedar na Vercel.

## O que tem aqui

- **Compromissos:** data/hora, categoria, local, notas, antecedência do aviso, edição, conclusão, filtros e calendário.
- **Lembranças:** fotos privadas, compressão no aparelho, legenda, data, favoritas, busca e visualização ampliada.
- **Treinos:** criar/editar treinos, dias da semana, exercícios, séries, repetições, carga, descanso, notas e histórico de conclusão diária.
- **Conta:** email/senha, confirmação, recuperação de acesso e dados separados por usuário.
- **PWA + Web Push:** instalar no celular e receber lembretes com a página fechada, após configuração e permissão.
- **Login obrigatório:** a versão publicada não tem mais atividades de demonstração. Sem conexão com o banco, ela informa a pendência e não simula salvamento.

## Publicar na Vercel — configuração necessária

Importar o GitHub publica a interface. Para ativar banco, login, fotos e notificações reais, complete os passos abaixo. Sem as credenciais do Supabase, o login mostra “Falta conectar o banco de dados”. Não publique chaves privadas em arquivos do repositório e não use prefixo `VITE_` em segredos.

### Correção de salvamento e conexão automática

O site agora lê a configuração pública em `/api/config`, no servidor. Isso permite usar diretamente os nomes criados pela integração oficial Supabase/Vercel, sem depender do prefixo Vite:

- URL: `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` ou `VITE_SUPABASE_URL`.
- Chave pública: `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ou `VITE_SUPABASE_ANON_KEY`.
- Web Push público: `VAPID_PUBLIC_KEY` ou `VITE_VAPID_PUBLIC_KEY`.

`service_role` e `sb_secret_` nunca são devolvidas por esse endpoint. **Conectar Supabase na sua conta Vercel não basta:** vincule o banco especificamente ao projeto **rayza** e ao ambiente **Production**, confirme que as variáveis apareceram e faça redeploy.

Depois de conectar, crie a conta dela e entre **com o mesmo e-mail e senha no celular e no computador**. O login permanece salvo no navegador. As telas consultam o banco ao entrar, ao voltar para a página e a cada 15 segundos enquanto ela estiver visível; uma edição aberta não é substituída por essa atualização.

As ações de salvar/excluir só apresentam sucesso após confirmação do banco. Falhas mantêm os campos para tentar novamente. O mesmo identificador é reutilizado se a resposta de um salvamento se perder, reduzindo duplicações. Tocar no fundo não fecha o formulário; cancelar com mudanças pede confirmação. Filtros são limpos após salvar um compromisso, para que ele não desapareça por ter mudado de dia.

### 1. Criar o banco no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com/dashboard).
2. No **SQL Editor**, execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) **uma vez**. Ele cria tabelas, políticas por usuário, fila de notificações e bucket **privado** `memories`.
   - Se já executou esse schema na primeira versão, **não execute novamente**: aplique apenas [`supabase/migrations/20261115_notification_status.sql`](supabase/migrations/20261115_notification_status.sql), que acrescenta o diagnóstico do agendador sem apagar dados.
3. Em **Project Settings → API**, copie a URL, a chave pública `anon` e a chave privada `service_role`. Use as chaves correspondentes disponíveis em “Legacy API keys” se o painel apresentar também as novas publishable/secret keys.
4. Em **Authentication → URL Configuration**, defina **Site URL** e a URL de redirecionamento com seu endereço de produção (ex.: `https://rayza.vercel.app`). Para desenvolvimento, adicione `http://localhost:5173` nas URLs de redirecionamento.
5. Mantenha confirmação de email ativada. Configure um provedor SMTP em **Authentication → Email** para envio de emails de confirmação/recuperação em produção; o serviço padrão tem limites para testes.

As regras permitem cadastro de contas próprias. Se quiser que só sua namorada tenha acesso, crie a conta dela, confirme o email e depois **desative novos cadastros** nas configurações de Auth do Supabase. O banco e as fotos continuam isolados por usuário.

### 2. Gerar as chaves de notificações

No computador com Node 22 ou superior:

```sh
npm install
npm run vapid
```

Guarde o par `Public Key` e `Private Key`. **Não gere um novo par a cada deploy**, pois as inscrições existentes dependem dessas chaves. Use um email seu em `VAPID_SUBJECT` (formato `mailto:voce@exemplo.com`).

### 3. Importar o GitHub na Vercel

Importe **guiviana128/Rayza**, branch **main**, preset **Vite**. O repositório já define `npm run build` e saída `dist` em [`vercel.json`](vercel.json). Não precisa de domínio pago.

Em **Project → Settings → Environment Variables**, adicione:

| Variável | Valor | Visível no navegador? |
|---|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | Sim |
| `VITE_SUPABASE_ANON_KEY` | Chave pública anon | Sim, protegida por RLS |
| `VITE_VAPID_PUBLIC_KEY` | Public Key gerada | Sim |
| `SUPABASE_URL` | Mesma URL do Supabase | Não |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave privada service_role | **Não** |
| `VAPID_PUBLIC_KEY` | Mesma Public Key | Não |
| `VAPID_PRIVATE_KEY` | Private Key gerada | **Não** |
| `VAPID_SUBJECT` | `mailto:seu-email@exemplo.com` | Não |
| `CRON_SECRET` | Um segredo aleatório de pelo menos 32 caracteres | **Não** |

Gere `CRON_SECRET` localmente, por exemplo:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

As variáveis `VITE_` são incorporadas no build: faça **Redeploy** após adicioná-las ou alterá-las. Nunca coloque `service_role` ou a chave VAPID privada em uma variável `VITE_`.

### 4. Ativar o envio automático a cada minuto

Usamos **Supabase Cron + pg_net → função na Vercel**. Assim o envio independe da página aberta e não requer o cron de frequência limitada da Vercel Hobby.

1. No Supabase, em **Database → Extensions**, habilite `pg_cron` e `pg_net`.
2. No **Vault** do Supabase, crie dois secrets pelo painel:
   - `rayza_site_url`: URL final de produção, sem barra no final, ex.: `https://rayza.vercel.app`.
   - `rayza_cron_secret`: **exatamente o mesmo** valor da variável `CRON_SECRET` da Vercel.
3. Execute [`supabase/scheduler.sql`](supabase/scheduler.sql) no SQL Editor.
4. Use um domínio de produção acessível pelo agendador. Proteção por login da Vercel em previews bloqueia o pedido do Supabase; não use uma URL de preview protegida no Vault.
5. Verifique **Integrations → Cron** e as consultas de diagnóstico ao final do SQL. HTTP `200` é esperado; `401` indica segredo divergente e `503` indica variáveis ausentes.

**Importante:** se mudar o domínio, atualize `rayza_site_url` no Vault e as URLs do Supabase Auth. Evite executar dois agendadores para o mesmo site.

### 5. Ativar no aparelho dela

1. Abra o site publicado, crie a conta, confirme o email e entre.
2. Toque no sino → **Ativar neste aparelho** → permita notificações.
3. **iPhone/iPad (iOS 16.4+):** primeiro abra pelo Safari → Compartilhar → **Adicionar à Tela de Início**. Abra pelo ícone instalado e então ative os avisos.
4. **Android/computador:** use Chrome/Edge/Firefox ou outro navegador compatível; instalar é recomendado no celular.
5. O botão **Enviar teste pelo servidor** faz um pedido autenticado a `/api/push-test`, que envia um Web Push real à inscrição desse aparelho. Confira se o aviso apareceu na central de notificações.
6. Em **Verificar configuração**, o site mostra separadamente a inscrição do aparelho, a configuração do servidor e se o agendador rodou nos últimos 3 minutos. Servidor configurado sozinho não significa que o cron está ativo.

**Teste completo de produção:** cadastre um compromisso para daqui a 3 minutos, escolha “No horário”, feche a página, mantenha internet e aguarde. Confira a notificação e os registros em `reminder_jobs` (`sent`) e `reminder_deliveries`, junto aos logs da função Vercel e respostas do cron. Edite, conclua ou exclua outro compromisso antes do horário e confirme que o aviso anterior foi cancelado.

## Como os avisos funcionam

O banco cria um job ao cadastrar/editar um compromisso. Cada minuto o cron chama `/api/reminders` com `Authorization: Bearer CRON_SECRET`. A função usa Web Push + VAPID para enviar aos aparelhos inscritos. O service worker exibe o aviso sem a página aberta; tocar no aviso abre Compromissos.

- Antecedência: horário, 5/15/30 minutos, 1 hora ou 1 dia antes. Se cadastrar depois da antecedência, o aviso fica disponível no próximo ciclo.
- Concluir, alterar dados relevantes ou excluir cancela a fila anterior. Notificação já entregue ao serviço push não pode ser recolhida.
- Lotes pequenos, lease de 2 minutos, tentativas limitadas e registro por aparelho reduzem duplicações. A entrega tem semântica **pelo menos uma vez**: uma queda entre envio e gravação pode causar reenvio; a `tag` estável ajuda o aparelho a agrupar/substituir.
- Falhas temporárias têm até 5 tentativas; inscrições `404/410` são removidas. Jobs expiram 1 hora após o compromisso; sem aparelhos inscritos, aguardam inscrição até expirar.
- A função aceita somente endpoints de provedores push de navegadores conhecidos para reduzir abuso de rede.
- O endpoint é protegido por segredo; tabelas de fila não são acessíveis pelo cliente.
- O botão Sair desinscreve este aparelho, para evitar que a conta continue enviando avisos em dispositivo compartilhado. Ao entrar novamente, ative os avisos outra vez.
- **Treinos não enviam avisos automaticamente:** para lembrar de treinar, crie um compromisso com a data/hora desejada.

**Limites reais:** push precisa de internet, permissões e suporte do sistema. Economia de bateria, modo foco, navegador forçadamente encerrado, serviços suspensos e limites dos provedores podem atrasar/impedir a entrega. Não é um alarme garantido nem uma solução para lembretes críticos. O ciclo é de aproximadamente 1 minuto, mais o tempo do serviço push. Supabase deve permanecer ativo; planos gratuitos podem pausar projetos sem atividade. As cotas/custos dos serviços dependem das suas contas.

Referências: [Supabase Cron](https://supabase.com/docs/guides/cron), [bucket privado e RLS](https://supabase.com/docs/guides/storage/security/access-control), [Web Push no iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [limites do cron Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing), [web-push](https://github.com/web-push-libs/web-push).

## Desenvolvimento

```sh
npm install
# Copie .env.example para .env.local e preencha suas chaves para usar o banco.
npm run dev
npm test
npm run build
npm run preview
```

Sem variáveis, aparece a página de conexão pendente. As funções `/api` executam na Vercel; para testá-las localmente use o ambiente Node/serverless apropriado. No Vite local, as variáveis públicas `VITE_` de `.env.local` continuam disponíveis como alternativa. Não há banco persistente em memória: a persistência é Postgres + Storage do Supabase.

### Organização

```text
index.html             HTML e metadados
src/app.js             interface e fluxos das três abas
src/style.css          tema roxo/lilás e responsividade
src/store.js           autenticação/banco, fotos e configuração
src/auth-view.js       página de login/cadastro/recuperação
src/push.js            inscrição dos aparelhos
src/domain.js          validações e datas
api/reminders.js       função Vercel de envio
api/config.js          configuração pública compatível com integração Vercel
api/push-test.js       teste real de envio ao aparelho, autenticado
api/notification-status.js diagnóstico do servidor/agendador
server/push.js         validação de endpoints e entrega
public/sw.js           recebimento de push
supabase/schema.sql    tabelas, RLS, bucket e fila
supabase/scheduler.sql cron por minuto, com segredos do Vault
tests/                 testes de validação, entrega e fluxos
```

As fotos reais ficam no bucket privado; URLs assinadas expiram após 1 hora e são atualizadas durante o uso. A aplicação não faz cache de dados privados no service worker. Fontes do Google são opcionais para o visual: há fontes alternativas locais. As antigas ilustrações de exemplo não aparecem nas contas reais.

# Rayza 💜

Um cantinho pessoal em roxo e lilás, feito com HTML, CSS e JavaScript. Login único, compromissos, galeria privada e treinos editáveis. Backend integrado à Vercel, sem banco externo para conectar.

## Como usar

Abra o site e entre com **rayza.huang** e a senha definida pelo responsável. Use o mesmo acesso no celular e no computador. O nome já vem preenchido; a senha é validada no servidor e não está no GitHub.

- **Compromissos:** criar, editar, concluir e excluir; data, hora, local, notas e antecedência.
- **Lembranças:** fotos privadas com data, legenda e favoritas. Imagens são reduzidas no aparelho antes do envio.
- **Treinos:** exercícios, dias da semana, séries, repetições, carga, descanso e registro de conclusão diária.
- **Financeiro:** controle de gastos e entradas mensais (salário, pagamento da Maria, VR, etc.), categorias alteráveis (ex.: "ração do Bryan"), cartões de crédito/débito, área Pix com identificação do destinatário, alternância de status pago/pendente com 1 clique e cálculo de saldo previsto.
- **Sincronização:** ao abrir/voltar à página, atualizar manualmente e a cada 15 segundos com a tela visível. Uma edição aberta é preservada.
- **Salvamento:** só confirma sucesso após gravação no servidor. Erros mantêm os campos para tentar novamente. Exclusões persistem após atualizar.

## Infraestrutura já conectada

O projeto usa um **Vercel Blob privado**, vinculado ao projeto Vercel `rayza`. Dados ficam em `rayza/database-v1.json`; fotos, em `rayza/photos/`. Leitura autenticada, sem cache de dados privados. As gravações usam ETag e `ifMatch` com novas tentativas para evitar sobrescritas entre aparelhos.

Sessão em cookie `HttpOnly`, `Secure`, `SameSite=Lax`, assinado no servidor e com duração de 30 dias. Mudar o hash da senha invalida as sessões anteriores. APIs validam sessão e origem, limitam tamanhos e campos e não retornam tokens do armazenamento. O login limita tentativas em armazenamento compartilhado.

As variáveis privadas foram configuradas na Vercel: `BLOB_READ_WRITE_TOKEN`, `RAYZA_USERNAME`, `RAYZA_PASSWORD_HASH`, `RAYZA_SESSION_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` e `CRON_SECRET`. Não coloque valores reais no Git. O arquivo `.env.example` contém apenas nomes e placeholders.

## Notificações no celular

Toque no sino e em **Ativar neste aparelho**. A permissão é individual: ativar no computador não ativa o celular.

- **iPhone/iPad:** Safari → Compartilhar → Adicionar à Tela de Início. Abra pelo ícone e ative os avisos (iOS 16.4 ou superior).
- **Android:** use um navegador compatível, permita notificações e instale o aplicativo se desejar.
- **Enviar teste pelo servidor:** envia Web Push real à inscrição deste aparelho. Confira a central de notificações.

O servidor publica os compromissos em **Vercel Queues** com atraso até o horário desejado. Compromissos distantes são reencaminhados em etapas de até 6 dias. O consumidor valida a revisão atual antes de enviar; editar, concluir ou excluir cancela o aviso antigo. Registra entrega por aparelho e usa uma tag estável para reduzir duplicações em retries. Inscrições expiradas são removidas.

Uma recuperação diária no cron da Vercel retenta publicações pendentes. Ela não é responsável pelo horário normal dos avisos: os disparos são feitos pela fila durável. Lembretes também podem ser recuperados ao ativar um aparelho. Treinos não geram avisos por conta própria; crie um compromisso para lembrar de treinar.

Web Push depende de conexão, permissão e suporte do sistema. Modo foco/economia de bateria podem atrasar avisos. Entrega é pelo menos uma vez, não um alarme garantido. O uso segue as cotas da conta Vercel; não é necessário configurar um provedor de banco separado.

## Desenvolvimento e arquivos

```sh
npm install
npm test
npm run build
```

As APIs executam na Vercel. Para testar localmente com o backend, use o ambiente Vercel com as variáveis privadas; o Vite isolado serve apenas o frontend.

`src/` contém a interface; `api/` contém login, sessão, dados, fotos e notificações; `server/` contém validação, sessão, armazenamento e fila. `public/sw.js` recebe os avisos sem a página aberta. Os testes cobrem fluxos de interface, sessões, concorrência, edição, exclusão, retries, validação e privacidade das configurações.

Referências: [Vercel Blob privado](https://vercel.com/docs/vercel-blob/private-storage), [gravações condicionais](https://vercel.com/docs/vercel-blob/using-blob-sdk), [Vercel Queues](https://vercel.com/docs/queues/sdk).

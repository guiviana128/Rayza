# Correção de login, persistência e notificações

## Causa confirmada em produção

O projeto Vercel `rayza` não tinha variáveis de ambiente nem integração Supabase listada na equipe selecionada. O bundle publicado não continha URL Supabase. A interface anterior entrava em uma demonstração em memória; salvar/excluir alterava apenas aquele estado e o F5 recriava os exemplos. Isso também impedia sincronizar celular/computador.

## Mudanças

- Página de login obrigatória, com cadastro e recuperação de senha. Sem dados fictícios no aplicativo publicado.
- Configuração pública em runtime, compatível com variáveis Supabase/Vercel e filtro contra chaves privilegiadas.
- Sessão persistida pelo SDK Supabase e dados sempre associados ao usuário autenticado.
- Confirmação de criação/edição/exclusão pelo banco, prazo de conexão, erros visíveis e formulário preservado. Retry de criação usa o mesmo UUID.
- Toques no fundo não fecham o editor, Escape/cancelamento com alterações pedem confirmação e os controles são bloqueados durante o envio.
- Limpeza dos filtros após salvar compromissos para evitar sumiço por mudança de dia.
- Atualização entre aparelhos a cada 15 segundos e ao voltar à tela, sem substituir formulário aberto ou campo ativo.
- Consulta de notificações separada da carga de dados: falha de push não esconde compromissos.
- Teste de Web Push real pelo servidor, autenticado e limitado à inscrição do usuário. Diagnóstico independente de aparelho, servidor e último ciclo do agendador.
- Tabela de heartbeat com RLS, sem acesso cliente. Migração adicional para instalações existentes, sem apagar dados.

## Verificação

31 testes aprovados, incluindo cenários com duas instâncias da interface usando o mesmo backend de teste, recarga após edição/exclusão, falhas antes/depois de commit, retry sem duplicação, preservação de formulário, configuração com nomes da integração e bloqueio de chaves privadas no endpoint público. O schema segue validado com PGlite e as regras Auth/Storage simuladas.

O banco real e a entrega no celular ainda exigem conexão do projeto Supabase e teste no aparelho com permissão. As chaves VAPID e o segredo de cron foram configurados no projeto Vercel sem serem gravados no Git. Não há garantia de entrega no aparelho sem banco, agendador, inscrição e permissão ativos.

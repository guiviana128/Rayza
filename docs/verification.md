# Verificação da entrega

- Node 24, instalação via npm com lockfile.
- 19 testes automatizados: validação/datas, conteúdo HTML, exercícios malformados, guardas contra respostas de outra sessão, exclusão segura, autenticação de cron, restrição de endpoints, retries/deduplicação, fencing de lease e três fluxos de interface em JSDOM.
- Schema SQL executado em Postgres embarcado (PGlite), com schemas/roles Auth e Storage simulados: RLS, isolamento de fotos, bloqueio de acesso cliente à fila, constraint dos exercícios, criação/cancelamento e recuperação de jobs verificados. Não substitui executar os SQLs no Supabase real.
- Build de produção Vite concluído; verificação HTTP local retornou 200 com título e manifesto.
- Revisão independente de código realizada; achados sobre exercícios, sessão, lease e exclusão tratados com regressões.
- A ferramenta de navegador desta sessão falhou ao inicializar. Não foi possível fazer inspeção visual real em desktop/celular; JSDOM verifica fluxos, não renderização.
- Não foram fornecidas credenciais Supabase/Vercel, então não houve teste real de cadastro/email, upload privado, cron nem Web Push entre servidor e aparelho. O README contém configuração e teste de produção com a página fechada.

Decisões: fila no Supabase Cron para frequência de um minuto, sem exigir Vercel Pro; notificações de treinos são criadas como compromissos; dados da demo são temporários; chaves devem ser inseridas pelos painéis, nunca no Git.

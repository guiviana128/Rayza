# Rayza — um cantinho só seu

Presente pessoal para a namorada do usuário: três abas em português, Compromissos, Lembranças e Treinos. Roxo e lilás, editorial romântico, responsivo, acessível, sem dados pessoais fictícios na conta real.

Escolha do usuário: versão completa, sincronizada e com notificações mesmo com a página fechada; publicar na main de guiviana128/Rayza, hospedagem posterior pelo usuário na Vercel. HTML, CSS e JavaScript, sem framework de interface.

Arquitetura: Vite para empacotar JavaScript; Supabase Auth/Postgres/Storage com políticas por usuário e bucket privado; função Node na Vercel com web-push, fila SQL com lease, tentativas e deduplicação por dispositivo; Supabase Cron chama endpoint a cada minuto com segredo guardado no Vault. A alternativa local não atende ao pedido de sincronização/push e foi descartada.

Compromissos: título, data/hora local, categoria, local/notas, antecedência, edição, conclusão, exclusão, filtro e calendário mensal. Lembranças: upload comprimido de fotos, legenda, data, favoritas, edição, visualização e exclusão. Treinos: título, dias, foco, duração, notas e lista editável de exercícios (séries, repetições, carga, descanso); marcar treino feito no dia. Não são prescrições de exercícios.

Login por email/senha, recuperação de senha e saída. Prévia demonstrativa explícita em memória quando sem conta; não confundir com dados sincronizados. PWA instalável com service worker de push; nunca usar timers da página para simular envio fechado. Login/banco/push real exigem variáveis e execução dos SQLs nas contas do usuário. Nenhum segredo deve entrar no Git. Push depende de permissão, conectividade e SO; no iOS exige instalação na tela inicial. Sem promessa de alarme exato ou entrega garantida.

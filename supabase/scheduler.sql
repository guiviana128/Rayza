-- Depois de publicar na Vercel, habilite pg_cron e pg_net em Database > Extensions.
-- No Supabase Vault, crie dois secrets:
-- rayza_site_url = https://SEU-SITE.vercel.app (sem / no final)
-- rayza_cron_secret = exatamente o CRON_SECRET configurado na Vercel.
-- Não coloque os valores em um repositório público.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('rayza-reminders','* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='rayza_site_url') || '/api/reminders',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='rayza_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
-- Diagnóstico: select * from cron.job_run_details order by start_time desc limit 10;
-- Respostas HTTP: select id,status_code,error_msg from net._http_response order by id desc limit 10;

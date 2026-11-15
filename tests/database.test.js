import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('database enforces account isolation, private photos, scheduling, cancellation and leases',async()=> {
  const db=new PGlite();
  const u1='11111111-1111-4111-8111-111111111111',u2='22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
      insert into auth.users values ('${u1}'),('${u2}');`);
    const schema=(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;','');
    await db.exec(schema);
    await db.exec('grant usage on schema public,auth,storage to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated; grant select,insert,delete on storage.objects to authenticated;');
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${u1}';`);
    const row=await db.query(`insert into public.appointments(title,starts_at,reminder_minutes) values ('Meu plano',now()+interval '5 minutes',15) returning id`);
    const id=row.rows[0].id;
    await db.exec(`insert into storage.objects(bucket_id,name) values('memories','${u1}/foto.jpg')`);
    await assert.rejects(()=>db.exec(`insert into storage.objects(bucket_id,name) values('memories','${u2}/foto.jpg')`),/row-level security/);
    const hidden=await db.query('select * from public.reminder_jobs');assert.equal(hidden.rows.length,0);
    await assert.rejects(()=>db.query('select * from public.claim_reminder_jobs(5)'),/permission denied/);
    await db.exec(`set request.jwt.claim.sub='${u2}';`);
    assert.equal((await db.query('select * from public.appointments')).rows.length,0);
    assert.equal((await db.query('select * from storage.objects')).rows.length,0);
    await assert.rejects(()=>db.exec(`insert into public.memories(title,photo_path) values('Outra','${u1}/foto.jpg')`),/row-level security/);
    await assert.rejects(()=>db.exec(`insert into public.workouts(title,exercises) values('Invalido','[null]')`),/check constraint/);
    await assert.rejects(()=>db.exec(`insert into public.workouts(title,exercises) values('HTML','[{"name":"X","sets":"<img src=x>","rest":60,"reps":"12","weight":""}]')`),/check constraint/);
    await db.exec('reset role;');
    assert.equal((await db.query('select * from public.reminder_jobs')).rows.length,1);
    const claim=await db.query('select * from public.claim_reminder_jobs(5)');assert.equal(claim.rows.length,1);
    assert.equal((await db.query('select * from public.claim_reminder_jobs(5)')).rows.length,0,'lease prevents concurrent claims');
    await db.exec(`update public.reminder_jobs set locked_until=now()-interval '1 minute'`);
    assert.equal((await db.query('select * from public.claim_reminder_jobs(5)')).rows[0].attempts,2,'expired lease is recoverable');
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${u1}';update public.appointments set completed=true where id='${id}';reset role;`);
    assert.equal((await db.query('select status from public.reminder_jobs')).rows[0].status,'cancelled');
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${u1}';update public.appointments set completed=false where id='${id}';reset role;`);
    assert.equal((await db.query("select * from public.reminder_jobs where status='pending'")).rows.length,1);
    await db.exec(`delete from public.appointments where id='${id}'`);assert.equal((await db.query('select * from public.reminder_jobs')).rows.length,0);
  } finally {await db.close();}
});

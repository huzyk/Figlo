import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('Postgres RLS isolates accounts, protects system columns and rejects revoked sessions', async () => {
  const db = new PGlite();
  const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
  const sa='10000000-0000-4000-8000-000000000001', sb='10000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; grant usage on schema auth to authenticated;
      create table auth.users(id uuid primary key);
      create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
      create table auth.audit_log_entries(created_at timestamptz,payload jsonb);
      create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
      create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
      insert into auth.users values ('${a}'),('${b}');
      insert into auth.sessions values ('${sa}','${a}',null),('${sb}','${b}',null);`);
    await db.exec(await readFile(new URL('../supabase/migrations/202610160001_accounts.sql',import.meta.url),'utf8'));
    const login = async (id,sid) => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:sid})]);
      await db.exec('set role authenticated');
    };
    await login(a,sa);
    await db.query('insert into public.profiles(id,nickname) values ($1,$2)',[a,'Hubert Żyła']);
    await assert.rejects(db.query('insert into public.profiles(id,nickname) values ($1,$2)',[b,'Intruder']));
    await assert.rejects(db.exec("update public.profiles set created_at=now()"));
    await assert.rejects(db.query('update public.profiles set id=$1',[b]));
    await assert.rejects(db.exec('select public.security_counts()'));
    await assert.rejects(db.exec('select * from auth.sessions'));
    await login(b,sb);
    assert.equal((await db.exec('select * from public.profiles'))[0].rows.length,0);
    await db.query('insert into public.profiles(id,nickname) values ($1,$2)',[b,'Gracz B']);
    await db.query('update public.profiles set nickname=$1 where id=$2',['Hacked',a]);
    await login(a,sa);
    assert.deepEqual((await db.query('select nickname from public.profiles')).rows,[{nickname:'Hubert Żyła'}]);
    // Same upsert used by PostgREST: own update works without broad table privileges.
    await db.query('insert into public.profiles(id,nickname) values ($1,$2) on conflict(id) do update set id=excluded.id,nickname=excluded.nickname',[a,'Nowy nick']);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.exec('select * from public.profiles'));
    await assert.rejects(db.exec('select public.account_session_active()'));
    await db.exec('reset role');
    await db.query('delete from auth.sessions where id=$1',[sa]);
    await login(a,sa);
    assert.equal((await db.query('select * from public.profiles')).rows.length,0);
    await assert.rejects(db.query('insert into public.profiles(id,nickname) values ($1,$2) on conflict(id) do update set nickname=excluded.nickname',[a,'Revoked']));
    await db.exec('reset role');
    await db.query('delete from auth.users where id=$1',[a]);
    assert.equal((await db.query('select * from public.profiles where id=$1',[a])).rows.length,0);
    assert.equal((await db.query('select * from public.profiles where id=$1',[b])).rows.length,1);
  } finally { await db.close(); }
});

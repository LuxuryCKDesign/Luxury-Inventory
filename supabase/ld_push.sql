-- Avisos push de Luxury Inventory (función ld-push). Solo agrega cosas nuevas: no cambia kardex_store ni sus datos.
create extension if not exists pg_net;

-- suscripciones de los teléfonos (solo la función, con la llave de servicio, las lee y escribe)
create table if not exists public.ld_push_subs (
  endpoint   text primary key,
  sub        jsonb not null,
  device     text,
  who        text,
  prefs      jsonb not null default '{}'::jsonb,
  fails      int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ld_push_subs enable row level security;

create table if not exists public.ld_push_log (
  id    bigserial primary key,
  at    timestamptz not null default now(),
  kind  text,
  title text,
  body  text,
  sent  int,
  failed int
);
alter table public.ld_push_log enable row level security;

-- dirección de la función, clave compartida y llaves VAPID (privado: sin políticas; solo el disparador y la
-- función, con la llave de servicio, lo leen). Las llaves VAPID las genera la función la primera vez.
create table if not exists public.ld_push_config (
  id     int primary key default 1 check (id = 1),
  fn_url text not null,
  secret text not null
);
alter table public.ld_push_config add column if not exists vapid_public text;
alter table public.ld_push_config add column if not exists vapid_private text;
alter table public.ld_push_config add column if not exists vapid_subject text;
alter table public.ld_push_config enable row level security;
insert into public.ld_push_config (id, fn_url, secret)
values (1, 'https://uaketjzcyvokdnopnyxy.supabase.co/functions/v1/ld-push',
        replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

-- lo guardado puede venir como texto JSON o como jsonb (y a veces como texto dentro de jsonb)
create or replace function public.ld_as_json(t text) returns jsonb
language plpgsql immutable as $$
declare j jsonb;
begin
  if t is null then return null; end if;
  begin j := t::jsonb; exception when others then return null; end;
  if jsonb_typeof(j) = 'string' then
    begin j := (j #>> '{}')::jsonb; exception when others then return null; end;
  end if;
  return j;
end $$;

create or replace function public.ld_push_send(p_kind text, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare c record;
begin
  select fn_url, secret into c from public.ld_push_config where id = 1;
  if c is null then return; end if;
  perform net.http_post(
    url := c.fn_url,
    body := jsonb_build_object('action', 'notify', 'kind', p_kind, 'title', p_title, 'body', p_body, 'tag', p_kind || ':' || left(md5(coalesce(p_body, '')), 10)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ld-secret', c.secret),
    timeout_milliseconds := 8000
  );
end $$;

-- avisa: trabajo (orden) nuevo, orden completada, piezas listas en el taller, todos los muebles armados.
-- Nunca frena el guardado: si algo falla aquí, el dato se guarda igual.
create or replace function public.ld_push_on_store() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  nv jsonb; ov jsonb; o jsonb; antes jsonb; nuevos int := 0; nombre text; primeros text := '';
begin
  begin
    if NEW.key = 'kardex:orders' and TG_OP = 'UPDATE' then
      nv := public.ld_as_json(NEW.value::text);
      ov := public.ld_as_json(OLD.value::text);
      if jsonb_typeof(nv) = 'array' and jsonb_typeof(ov) = 'array' then
        -- estado de cada orden antes del cambio, por id
        select coalesce(jsonb_object_agg(e->>'id', coalesce(e->>'status', '')), '{}'::jsonb) into antes
          from jsonb_array_elements(ov) e where e->>'id' is not null;
        for o in select * from jsonb_array_elements(nv) loop
          nombre := coalesce(nullif(o->>'job', ''), 'sin nombre');
          if o->>'id' is null then continue; end if;
          if not (antes ? (o->>'id')) then
            nuevos := nuevos + 1;
            if nuevos <= 3 then primeros := primeros || case when primeros = '' then '' else ' · ' end || nombre; end if;
          elsif (antes->>(o->>'id')) <> 'completado' and o->>'status' = 'completado' then
            perform public.ld_push_send('completado', 'Orden completada', nombre);
          end if;
        end loop;
        if nuevos = 1 then perform public.ld_push_send('nuevo', 'Trabajo nuevo', primeros);
        elsif nuevos > 1 then perform public.ld_push_send('nuevo', nuevos || ' trabajos nuevos', primeros || case when nuevos > 3 then ' …' else '' end);
        end if;
      end if;
    elsif TG_OP = 'INSERT' and NEW.key like 'ld:done:%' then
      nv := public.ld_as_json(NEW.value::text);
      perform public.ld_push_send('piezas', 'Piezas listas en el taller', coalesce(nullif(nv->>'job', ''), 'Un trabajo') || ': todas las piezas cortadas y con edgeband');
    elsif TG_OP = 'INSERT' and NEW.key like 'ld:armado:%' then
      nv := public.ld_as_json(NEW.value::text);
      perform public.ld_push_send('armado', 'Trabajo armado', coalesce(nullif(nv->>'job', ''), 'Un trabajo') || ': todos los muebles armados');
    end if;
  exception when others then
    -- el aviso no es más importante que guardar
    null;
  end;
  return NEW;
end $$;

drop trigger if exists ld_push_store on public.kardex_store;
create trigger ld_push_store after insert or update on public.kardex_store
  for each row when (NEW.key = 'kardex:orders' or NEW.key like 'ld:done:%' or NEW.key like 'ld:armado:%')
  execute function public.ld_push_on_store();

-- nadie desde la app (anon / usuarios) puede leer las suscripciones ni la configuración, ni mandar avisos a mano
revoke all on table public.ld_push_subs, public.ld_push_log, public.ld_push_config from anon, authenticated;
revoke all on sequence public.ld_push_log_id_seq from anon, authenticated;
revoke execute on function public.ld_push_send(text, text, text) from public, anon, authenticated;
revoke execute on function public.ld_push_on_store() from public, anon, authenticated;
revoke execute on function public.ld_as_json(text) from public, anon, authenticated;

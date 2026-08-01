begin;

-- ===== Preparación del entorno de pruebas =====

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

-- ===== Preparación de usuarios y recursos aislados =====

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'familia-a@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Familia A"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'familia-b@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Familia B"}', now(), now()
  );

insert into public.families (id, owner_user_id, name, timezone) values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Familia A', 'America/Monterrey'),
  ('22000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Familia B', 'America/Monterrey');

insert into public.properties (
  id, family_id, name, type, created_by_user_id, updated_by_user_id
) values
  (
    '11100000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001',
    'Casa A', 'house', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'
  ),
  (
    '22200000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002',
    'Casa B', 'house', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002'
  );

insert into public.documents (
  id, family_id, property_id, name, category, expiration_date,
  created_by_user_id, updated_by_user_id
) values (
  '11111000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  '11100000-0000-4000-8000-000000000001',
  'Documento vencido', 'contract', current_date - 1,
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';

-- ===== Verificación del aislamiento por familia =====

select is((select count(*) from public.users), 1::bigint, 'el perfil propio es visible');
select is((select count(*) from public.families), 1::bigint, 'solo la familia propia es visible');
select is((select count(*) from public.properties), 1::bigint, 'solo la vivienda propia es visible');
select is((select name from public.properties limit 1), 'Casa A', 'la vivienda ajena no se filtra por error');

select lives_ok(
  $$select public.create_property(
    '11110000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'Departamento A', 'apartment', null
  )$$,
  'el propietario puede crear en su familia'
);

select throws_ok(
  $$select public.create_property(
    '22220000-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000002',
    'Intento cruzado', 'house', null
  )$$,
  'P0002',
  'El recurso no existe.',
  'el propietario no puede crear en otra familia'
);

select is((select count(*) from public.properties), 2::bigint, 'la creación propia queda visible');
select is((select count(*) from public.properties where family_id = '22000000-0000-4000-8000-000000000002'), 0::bigint, 'la familia ajena continúa oculta');

-- ===== Verificación de recordatorios recurrentes =====

select lives_ok(
  $$select public.create_reminder(
    '11111100-0000-4000-8000-000000000001',
    '11111000-0000-4000-8000-000000000001',
    0::smallint,
    1::smallint
  )$$,
  'un recordatorio vencido se procesa al crearse'
);
select is(
  (select status from public.reminders where id = '11111100-0000-4000-8000-000000000001'),
  'notified',
  'el recordatorio vencido queda notificado'
);
select is(
  (select count(*) from public.notifications where reminder_id = '11111100-0000-4000-8000-000000000001'),
  1::bigint,
  'la notificación inmediata es única'
);
select is(
  (select repeat_interval_days from public.reminders where id = '11111100-0000-4000-8000-000000000001'),
  1::smallint,
  'el recordatorio conserva la frecuencia diaria'
);
select ok(
  (select scheduled_for > statement_timestamp() from public.reminders where id = '11111100-0000-4000-8000-000000000001'),
  'la siguiente repetición queda programada en el futuro'
);

-- ===== Limpieza del escenario =====

select * from finish();
rollback;

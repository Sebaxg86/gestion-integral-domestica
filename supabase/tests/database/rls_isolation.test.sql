begin;

select plan(8);

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

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';

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

select * from finish();
rollback;

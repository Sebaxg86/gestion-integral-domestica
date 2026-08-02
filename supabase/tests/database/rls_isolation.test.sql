begin;

-- ===== Preparación del entorno de pruebas =====

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

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

-- ===== Preparación del detalle vehicular aislado =====

insert into public.vehicles (
  id, family_id, name, type, mileage, created_by_user_id, updated_by_user_id
) values
  (
    '11120000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001', 'Vehículo A', 'car', 10000,
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '22220000-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000002', 'Vehículo B', 'car', 20000,
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002'
  );

insert into public.vehicle_services (
  id, family_id, vehicle_id, title, type, status,
  created_by_user_id, updated_by_user_id
) values
  (
    '11121000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    '11120000-0000-4000-8000-000000000001',
    'Servicio A', 'preventive', 'completed',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '22221000-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000002',
    '22220000-0000-4000-8000-000000000002',
    'Servicio B', 'preventive', 'completed',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002'
  );

insert into public.vehicle_service_items (
  id, family_id, vehicle_service_id, category, description, status,
  created_by_user_id, updated_by_user_id
) values
  (
    '11121100-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    '11121000-0000-4000-8000-000000000001',
    'brakes', 'Trabajo A', 'completed',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '22221100-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000002',
    '22221000-0000-4000-8000-000000000002',
    'oil', 'Trabajo B', 'completed',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002'
  );

insert into public.vehicle_service_parts (
  id, family_id, vehicle_service_id, vehicle_service_item_id, name, quantity,
  created_by_user_id, updated_by_user_id
) values
  (
    '11121200-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    '11121000-0000-4000-8000-000000000001',
    '11121100-0000-4000-8000-000000000001', 'Refacción A', 1,
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '22221200-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000002',
    '22221000-0000-4000-8000-000000000002',
    '22221100-0000-4000-8000-000000000002', 'Refacción B', 1,
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002'
  );

insert into public.vehicle_service_attachments (
  id, family_id, vehicle_service_id, kind, title, original_filename,
  storage_key, detected_mime_type, size_bytes, sha256,
  created_by_user_id, updated_by_user_id
) values
  (
    '11121300-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    '11121000-0000-4000-8000-000000000001',
    'receipt', 'Archivo A', 'archivo-a.pdf', 'families/a/archivo-a',
    'application/pdf', 100, repeat('a', 64),
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '22221300-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000002',
    '22221000-0000-4000-8000-000000000002',
    'receipt', 'Archivo B', 'archivo-b.pdf', 'families/b/archivo-b',
    'application/pdf', 100, repeat('b', 64),
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002'
  );

-- ===== Preparación de servicios programados aislados =====

insert into public.scheduled_services (
  id, family_id, name, category, recurrence, lead_days,
  created_by_user_id, updated_by_user_id
) values
  (
    '11130000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'Electricidad A', 'electricity', 'monthly', 7,
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '22230000-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000002',
    'Electricidad B', 'electricity', 'monthly', 7,
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002'
  );

insert into public.scheduled_service_occurrences (
  id, family_id, scheduled_service_id, sequence, due_date,
  created_by_user_id, updated_by_user_id
) values
  (
    '11131000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    '11130000-0000-4000-8000-000000000001', 1, current_date + 7,
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '22231000-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000002',
    '22230000-0000-4000-8000-000000000002', 1, current_date + 7,
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002'
  );

-- ===== Preparación de pendientes aislados =====

insert into public.tasks (
  id, family_id, property_id, title, category, priority,
  created_by_user_id, updated_by_user_id
) values
  (
    '11140000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    '11100000-0000-4000-8000-000000000001',
    'Pendiente A', 'household', 'normal',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '22240000-0000-4000-8000-000000000002',
    '22000000-0000-4000-8000-000000000002',
    '22200000-0000-4000-8000-000000000002',
    'Pendiente B', 'household', 'normal',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002'
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

-- ===== Verificación del aislamiento vehicular =====

select is((select count(*) from public.vehicles), 1::bigint, 'solo el vehículo propio es visible');
select is((select count(*) from public.vehicle_services), 1::bigint, 'solo el servicio propio es visible');
select is((select count(*) from public.vehicle_service_items), 1::bigint, 'solo el trabajo propio es visible');
select is((select count(*) from public.vehicle_service_parts), 1::bigint, 'solo la refacción propia es visible');
select is((select count(*) from public.vehicle_service_attachments), 1::bigint, 'solo el adjunto propio es visible');

-- ===== Verificación del aislamiento de servicios programados =====

select is(
  (select count(*) from public.scheduled_services),
  1::bigint,
  'solo el servicio programado propio es visible'
);
select is(
  (select count(*) from public.scheduled_service_occurrences),
  1::bigint,
  'solo la ocurrencia programada propia es visible'
);

-- ===== Verificación del aislamiento de pendientes =====

select is(
  (select count(*) from public.tasks),
  1::bigint,
  'solo el pendiente propio es visible'
);
select is(
  (select title from public.tasks limit 1),
  'Pendiente A',
  'el pendiente ajeno no se filtra por error'
);

-- ===== Verificación del seguimiento de kilometraje =====

select is(
  (select count(*) from public.vehicle_mileage_readings),
  1::bigint,
  'solo la lectura de kilometraje propia es visible'
);

select lives_ok(
  $$select public.record_vehicle_mileage(
    '11121400-0000-4000-8000-000000000001',
    '11120000-0000-4000-8000-000000000001',
    15000, current_date, 'Lectura de prueba'
  )$$,
  'el propietario puede registrar una lectura mayor'
);

select is(
  (select mileage from public.vehicles where id = '11120000-0000-4000-8000-000000000001'),
  15000,
  'la lectura mayor actualiza el kilometraje actual'
);

select lives_ok(
  $$select public.configure_vehicle_mileage_reminder(
    '11120000-0000-4000-8000-000000000001', 30::smallint
  )$$,
  'el propietario puede configurar el aviso periódico'
);

select is(
  (
    select count(*) from public.reminders
    where vehicle_id = '11120000-0000-4000-8000-000000000001'
      and status = 'scheduled'
  ),
  1::bigint,
  'el vehículo conserva un único aviso periódico abierto'
);

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

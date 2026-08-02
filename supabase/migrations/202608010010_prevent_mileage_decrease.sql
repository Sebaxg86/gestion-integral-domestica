-- ============================================================================
-- Protección global contra retrocesos de kilometraje
-- ============================================================================

-- ===== Regla aplicable a todos los flujos de actualización =====

create function public.prevent_vehicle_mileage_decrease()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- ------- Una lectura conocida no puede borrarse ni reducirse -------

  if old.mileage is not null
    and (new.mileage is null or new.mileage < old.mileage) then
    raise exception using
      errcode = '22023',
      message = 'El kilometraje no puede ser menor al actual.';
  end if;

  return new;
end;
$$;

create trigger vehicles_prevent_mileage_decrease
before update of mileage on public.vehicles
for each row execute function public.prevent_vehicle_mileage_decrease();

revoke all on function public.prevent_vehicle_mileage_decrease()
  from public, anon, authenticated;

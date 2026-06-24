alter table public.drivers
  add column if not exists driver_progress jsonb not null default '{}'::jsonb;

update public.drivers
set driver_progress = jsonb_build_object(
  'driver_license',
  case
    when coalesce(has_driver_license, false) then
      jsonb_build_array(
        jsonb_build_object(
          'status', 'uploaded',
          'created_at', coalesce(updated_at, now())
        )
      )
    else '[]'::jsonb
  end,
  'vehicle',
  case
    when vehicle is not null and vehicle <> '' then
      jsonb_build_array(
        jsonb_build_object(
          'status',
          case vehicle
            when 'ready' then 'approved'
            else vehicle
          end,
          'created_at', coalesce(updated_at, now())
        )
      )
    else '[]'::jsonb
  end,
  'freight_operator',
  case
    when freight_operator is not null and freight_operator <> '' then
      jsonb_build_array(
        jsonb_build_object(
          'status',
          case freight_operator
            when 'obtained' then 'acquired'
            when 'ready' then 'approved'
            else freight_operator
          end,
          'created_at', coalesce(updated_at, now())
        )
      )
    else '[]'::jsonb
  end,
  'black_plate',
  case
    when black_plate is not null and black_plate <> '' then
      jsonb_build_array(
        jsonb_build_object(
          'status',
          case black_plate
            when 'ready' then 'approved'
            else black_plate
          end,
          'created_at', coalesce(updated_at, now())
        )
      )
    else '[]'::jsonb
  end,
  'safety_manager',
  case
    when safety_manager is not null and safety_manager <> '' then
      jsonb_build_array(
        jsonb_build_object(
          'status',
          case safety_manager
            when 'obtained' then 'acquired'
            when 'ready' then 'approved'
            else safety_manager
          end,
          'created_at', coalesce(updated_at, now())
        )
      )
    else '[]'::jsonb
  end
)
where driver_progress = '{}'::jsonb;

alter table public.drivers
  drop column if exists has_driver_license,
  drop column if exists vehicle,
  drop column if exists freight_operator,
  drop column if exists black_plate,
  drop column if exists safety_manager;

notify pgrst, 'reload schema';

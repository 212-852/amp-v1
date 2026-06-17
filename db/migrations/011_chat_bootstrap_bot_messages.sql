create table if not exists public.participants (
  participant_uuid uuid primary key default gen_random_uuid(),
  room_uuid uuid not null references public.rooms(room_uuid) on delete cascade,
  role text not null
    check (role in ('guest', 'user', 'admin', 'driver', 'concierge', 'bot')),
  visitor_uuid uuid null references public.visitors(visitor_uuid),
  user_uuid uuid null references public.users(user_uuid),
  display_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visitor_uuid is not null or user_uuid is not null or role in ('bot', 'concierge'))
);

insert into public.participants (
  participant_uuid,
  room_uuid,
  role,
  visitor_uuid,
  user_uuid,
  display_name,
  created_at,
  updated_at
)
select
  participant_uuid,
  room_uuid,
  role,
  visitor_uuid,
  user_uuid,
  display_name,
  created_at,
  updated_at
from public.room_participants
on conflict (participant_uuid) do nothing;

create index if not exists participants_room_uuid_idx
  on public.participants (room_uuid);

create index if not exists participants_visitor_uuid_idx
  on public.participants (visitor_uuid);

create index if not exists participants_user_uuid_idx
  on public.participants (user_uuid);

create unique index if not exists participants_room_visitor_uidx
  on public.participants (room_uuid, visitor_uuid)
  where visitor_uuid is not null;

create unique index if not exists participants_room_user_uidx
  on public.participants (room_uuid, user_uuid)
  where user_uuid is not null;

drop trigger if exists participants_set_updated_at on public.participants;

create trigger participants_set_updated_at
before update on public.participants
for each row
execute function set_updated_at();

alter table public.messages
drop constraint if exists messages_participant_uuid_fkey;

alter table public.messages
add constraint messages_participant_uuid_fkey
foreign key (participant_uuid)
references public.participants(participant_uuid);

alter table public.room_typing_states
drop constraint if exists room_typing_states_participant_uuid_fkey;

alter table public.room_typing_states
add constraint room_typing_states_participant_uuid_fkey
foreign key (participant_uuid)
references public.participants(participant_uuid)
on delete cascade;

drop table if exists public.room_participants;

create table if not exists public.bot_messages (
  bot_message_uuid uuid primary key default gen_random_uuid(),
  message_key text not null,
  locale text not null default 'ja'
    check (locale in ('ja', 'en', 'es')),
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_key, locale)
);

drop trigger if exists bot_messages_set_updated_at on public.bot_messages;

create trigger bot_messages_set_updated_at
before update on public.bot_messages
for each row
execute function set_updated_at();

insert into public.bot_messages (message_key, locale, body, payload)
values
  (
    'welcome',
    'ja',
    'こんにちは！PET TAXIへようこそ。ご用件をお知らせください。',
    '{"web":{"variant":"text"},"line":{"type":"text","text":"こんにちは！PET TAXIへようこそ。ご用件をお知らせください。"}}'::jsonb
  ),
  (
    'welcome',
    'en',
    'Hello! Welcome to PET TAXI. How can we help you today?',
    '{"web":{"variant":"text"},"line":{"type":"text","text":"Hello! Welcome to PET TAXI. How can we help you today?"}}'::jsonb
  ),
  (
    'welcome',
    'es',
    'Hola! Bienvenido a PET TAXI. Como podemos ayudarte hoy?',
    '{"web":{"variant":"text"},"line":{"type":"text","text":"Hola! Bienvenido a PET TAXI. Como podemos ayudarte hoy?"}}'::jsonb
  ),
  (
    'quick_menu',
    'ja',
    'クイックメニューからご希望の内容を選んでください。',
    '{"web":{"variant":"cards","cards":[{"title":"使い方","body":"予約、相談、確認をチャットで進められます。","action":"how_to_use"},{"title":"FAQ","body":"よくある質問を確認できます。","action":"faq"},{"title":"Botモード","body":"自動案内で素早く確認します。","action":"bot_mode"},{"title":"Concierge","body":"スタッフに相談します。","action":"concierge_mode"}]},"line":{"type":"flex","altText":"クイックメニュー","contents":{"type":"carousel","contents":[{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"使い方","weight":"bold","size":"md"},{"type":"text","text":"予約、相談、確認をチャットで進められます。","wrap":true,"size":"sm"}]}},{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"FAQ","weight":"bold","size":"md"},{"type":"text","text":"よくある質問を確認できます。","wrap":true,"size":"sm"}]}},{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"Botモード","weight":"bold","size":"md"},{"type":"text","text":"自動案内で素早く確認します。","wrap":true,"size":"sm"}]}},{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"Concierge","weight":"bold","size":"md"},{"type":"text","text":"スタッフに相談します。","wrap":true,"size":"sm"}]}}]}}}'::jsonb
  ),
  (
    'quick_menu',
    'en',
    'Choose an option from the quick menu.',
    '{"web":{"variant":"cards","cards":[{"title":"How to use","body":"Book, ask, and confirm through chat.","action":"how_to_use"},{"title":"FAQ","body":"Check common questions.","action":"faq"},{"title":"Bot mode","body":"Use automated guidance for quick answers.","action":"bot_mode"},{"title":"Concierge","body":"Talk with our staff.","action":"concierge_mode"}]},"line":{"type":"flex","altText":"Quick Menu","contents":{"type":"carousel","contents":[{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"How to use","weight":"bold","size":"md"},{"type":"text","text":"Book, ask, and confirm through chat.","wrap":true,"size":"sm"}]}},{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"FAQ","weight":"bold","size":"md"},{"type":"text","text":"Check common questions.","wrap":true,"size":"sm"}]}},{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"Bot mode","weight":"bold","size":"md"},{"type":"text","text":"Use automated guidance for quick answers.","wrap":true,"size":"sm"}]}},{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"Concierge","weight":"bold","size":"md"},{"type":"text","text":"Talk with our staff.","wrap":true,"size":"sm"}]}}]}}}'::jsonb
  ),
  (
    'quick_menu',
    'es',
    'Elige una opcion del menu rapido.',
    '{"web":{"variant":"cards","cards":[{"title":"Como usar","body":"Reserva, consulta y confirma por chat.","action":"how_to_use"},{"title":"FAQ","body":"Consulta preguntas frecuentes.","action":"faq"},{"title":"Modo Bot","body":"Usa guia automatica para respuestas rapidas.","action":"bot_mode"},{"title":"Conserje","body":"Habla con nuestro equipo.","action":"concierge_mode"}]},"line":{"type":"flex","altText":"Menu rapido","contents":{"type":"carousel","contents":[{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"Como usar","weight":"bold","size":"md"},{"type":"text","text":"Reserva, consulta y confirma por chat.","wrap":true,"size":"sm"}]}},{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"FAQ","weight":"bold","size":"md"},{"type":"text","text":"Consulta preguntas frecuentes.","wrap":true,"size":"sm"}]}},{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"Modo Bot","weight":"bold","size":"md"},{"type":"text","text":"Usa guia automatica para respuestas rapidas.","wrap":true,"size":"sm"}]}},{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"Conserje","weight":"bold","size":"md"},{"type":"text","text":"Habla con nuestro equipo.","wrap":true,"size":"sm"}]}}]}}}'::jsonb
  ),
  ('bot_mode', 'ja', 'Botモードでは自動案内がすぐに回答します。', '{"web":{"variant":"text"},"line":{"type":"text","text":"Botモードでは自動案内がすぐに回答します。"}}'::jsonb),
  ('bot_mode', 'en', 'Bot mode gives quick automated guidance.', '{"web":{"variant":"text"},"line":{"type":"text","text":"Bot mode gives quick automated guidance."}}'::jsonb),
  ('bot_mode', 'es', 'El modo Bot ofrece guia automatica rapida.', '{"web":{"variant":"text"},"line":{"type":"text","text":"El modo Bot ofrece guia automatica rapida."}}'::jsonb),
  ('concierge_mode', 'ja', 'Conciergeモードではスタッフが確認して返信します。', '{"web":{"variant":"text"},"line":{"type":"text","text":"Conciergeモードではスタッフが確認して返信します。"}}'::jsonb),
  ('concierge_mode', 'en', 'Concierge mode lets our staff review and reply.', '{"web":{"variant":"text"},"line":{"type":"text","text":"Concierge mode lets our staff review and reply."}}'::jsonb),
  ('concierge_mode', 'es', 'El modo Conserje permite que nuestro equipo revise y responda.', '{"web":{"variant":"text"},"line":{"type":"text","text":"El modo Conserje permite que nuestro equipo revise y responda."}}'::jsonb),
  ('how_to_use', 'ja', 'チャットで予約相談、送迎内容の確認、サポート依頼ができます。', '{"web":{"variant":"text"},"line":{"type":"text","text":"チャットで予約相談、送迎内容の確認、サポート依頼ができます。"}}'::jsonb),
  ('how_to_use', 'en', 'Use chat to discuss bookings, confirm ride details, and request support.', '{"web":{"variant":"text"},"line":{"type":"text","text":"Use chat to discuss bookings, confirm ride details, and request support."}}'::jsonb),
  ('how_to_use', 'es', 'Usa el chat para reservas, detalles del traslado y soporte.', '{"web":{"variant":"text"},"line":{"type":"text","text":"Usa el chat para reservas, detalles del traslado y soporte."}}'::jsonb),
  ('faq', 'ja', 'FAQでは料金、対応エリア、予約方法を確認できます。', '{"web":{"variant":"text"},"line":{"type":"text","text":"FAQでは料金、対応エリア、予約方法を確認できます。"}}'::jsonb),
  ('faq', 'en', 'FAQ covers pricing, service areas, and how to book.', '{"web":{"variant":"text"},"line":{"type":"text","text":"FAQ covers pricing, service areas, and how to book."}}'::jsonb),
  ('faq', 'es', 'FAQ cubre precios, zonas de servicio y como reservar.', '{"web":{"variant":"text"},"line":{"type":"text","text":"FAQ cubre precios, zonas de servicio y como reservar."}}'::jsonb)
on conflict (message_key, locale) do update
set
  body = excluded.body,
  payload = excluded.payload,
  updated_at = now();

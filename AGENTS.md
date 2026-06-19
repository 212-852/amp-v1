#########################
UI LOCK RULE
#########################

IMPORTANT

Admin UI and Driver UI are LOCKED.

Unless the request explicitly contains:

* unlock admin ui
* unlock driver ui

the current visual design must remain unchanged.

LOCKED ITEMS

Admin

* header
* footer
* assistant card
* notification area
* navigation layout
* profile area

Driver

* header
* footer
* assistant card
* navigation layout
* profile area

LOCKED PROPERTIES

* layout
* spacing
* sizing
* colors
* typography
* positioning
* animation
* avatar size
* button placement
* header height
* footer height

Allowed

* bug fixes
* data binding fixes
* notification count updates
* text updates

Not Allowed

* redesign
* restyle
* reposition
* resize

#########################
SHARED UI RULE
#########################

Admin and Driver must share UI components.

Use:

* shared header
* shared footer
* shared assistant card
* shared robo_cat component

Do not duplicate UI implementations.

Fixes must be applied through shared components first.

#########################
ROBO CAT RULE
#########################

The robo_cat position is locked.

Use one shared component.

Use one shared CSS source.

Allowed

* shared css adjustment
* shared component adjustment

Not Allowed

* driver specific cat implementation
* admin specific cat implementation
* duplicate cat css

One cat.
One component.
One css source.

#########################
USER UI RULE
#########################

User UI is independent.

Admin and Driver fixes must never modify:

* user header
* user footer
* user navigation

User UI changes require explicit instructions.

#########################
CHAT TRANSLATION RULE
#########################

Messages must support automatic translation.

Default display:
- show the message in room.locale

Original text:
- must remain available
- can be toggled inside the same bubble

Store both:
- original text
- display text
- translations json

Do not translate during render.

AI translation is allowed only in the action layer.

Flow:
message
-> chat/context.ts
-> chat/room.ts
-> chat/rules.ts
-> chat/action.ts
-> chat/message.ts
-> chat/archive.ts
-> output

#########################
ROOM MODE RULE
#########################

rooms.mode is the single room mode.

Allowed:
- bot
- concierge
- group

Do not add rooms.type.

Do not duplicate mode meaning in another column.

#########################
CHAT ROLE RULE
#########################

Use guest for anonymous chat participants.

Do not use visitor as chat participant role.

visitor_uuid can remain as identity data.

participant role must use:
- guest
- user
- admin
- driver
- concierge
- bot

#########################
TYPING STATE RULE
#########################

Typing state is realtime only.

Typing state may be stored in room_typing_states.

Do not store typing events as messages.

Do not archive every typing event.

Do not send typing state through message archive.

Do not implement read receipts.

Forbidden:
- read_at
- seen_at
- read status UI
- read receipt notifications

#########################
MESSAGE OUTPUT RULE
#########################

One message bundle must be used for Web, PWA, LIFF, and LINE.

Do not create separate message logic for LINE and Web.

source_channel records where the message came from.

output rules decide where the reply is delivered.

#########################
BOT FIXED MESSAGE RULE
#########################

Bot fixed messages must be stored in bot_messages.

Do not hardcode bot welcome messages or quick menu messages inside UI.

Required bot message keys:
- welcome
- quick_menu
- bot_mode
- concierge_mode
- how_to_use
- faq

Messages must be resolved by:
bot_message.key
+
rooms.locale

Fallback locale:
ja

#########################
ROOM BOOTSTRAP RULE
#########################

If a user or guest has no room, create the room automatically.

Flow:
request
-> chat/context.ts
-> chat/room.ts
-> chat/action.ts
-> chat/message.ts
-> chat/archive.ts
-> output/index.ts

On room creation:
- create room
- create participant
- insert welcome message
- send welcome message

Do not create duplicate rooms.

LINE, LIFF, PWA, and Web must reuse the same room.

#########################
ROOM CHANNEL RULE
#########################

rooms.channel stores the first source channel for the room.

Allowed:
- web
- pwa
- liff
- line

Do not store source_channel or delivery_channel on messages.

Output destination is decided by the output bundle destination, not room identity.

#########################
QUICK MENU RULE
#########################

Quick Menu is a bot fixed message.

The center Quick Menu button must request bot_messages.key = quick_menu.

Quick Menu is not the same as the welcome message.

Use the same message payload for:
- Web chat
- PWA
- LIFF
- LINE Flex Message

Do not create separate Quick Menu logic per channel.

#########################
CHAT ROOM ABSOLUTE RULE
#########################

- One user has one personal chat room.
- Web, LINE, LIFF, and PWA must share the same room for the same user_uuid.
- Do not create rooms per channel.
- Do not include channel in the lookup key for personal rooms.
- channel is only metadata of the incoming message, not room identity.
- Use rooms.room_key as the stable room identity.
- Normal user room_key is user:<user_uuid>.
- Guest room_key is visitor:<visitor_uuid>.
- Order room_key is order:<order_uuid>.
- room_key must be unique.
- For logged-in users, resolve room by user_uuid only.
- For anonymous visitors, resolve room by visitor_uuid only.
- If order_uuid exists, resolve or create one room per order_uuid.
- Order room and personal room are different scopes.
- All messages from web, LINE, LIFF, and PWA must be archived into the same resolved room.
- participants must contain the user participant and bot participant for the resolved room.
- Never create a new room if a matching user_uuid personal room already exists.

#########################
ADDRESS SELECTION RULE
#########################

- Prefecture and city must always come from the centralized address core.
- Source tables are prefectures and cities.
- UI must not hardcode prefecture or city lists.
- UI must not create its own address arrays.
- Profile forms must use prefecture_code and city_code.
- Free text is allowed only for address line, not prefecture or city.

#########################
ADMIN/USER UI SEPARATION RULE
#########################

ADMIN/USER UI SEPARATION RULE
- Admin routes must never render user chat layout.
- User routes must never render admin concierge layout.
- AI assistant is allowed only on admin top page.
- Admin concierge list and individual room pages must not show AI assistant.
- /admin is the admin top page.
- /admin/list is the full concierge room list.
- /admin/list/[room_uuid] is the admin chat room page.
- /admin/concierge must redirect to /admin.
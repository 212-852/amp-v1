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

rooms.channel stores the latest incoming channel.

Allowed:
- web
- pwa
- liff
- line

Do not store source_channel or delivery_channel on messages.

Output destination is decided by rooms.channel.

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
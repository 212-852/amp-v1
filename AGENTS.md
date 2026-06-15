#########################
AMP v1
#########################

Core Principle

* One Build
* Single Core
* Multi Entrance
* One Source of Truth
* Shared logic is mandatory
* Every feature must pass through the core
* Do not duplicate business logic

#########################
COMMON RULE
#########################

* Use English only for code comments
* Use ASCII characters only in code comments
* Do not use emojis in code comments

#########################
CORE RULE
#########################

Centralize all business logic.

Do not duplicate logic.

Reuse core functions.

API must not contain business logic.

UI must not contain business logic.

Route handlers must not contain business logic.

Allowed:

request
-> context
-> rules
-> action
-> output

Not Allowed:

request
-> custom logic

api
-> custom logic

component
-> custom logic

#########################
SHARED CORE RULE
#########################

* Shared logic is mandatory
* Every entry point must call the same core
* Web and LINE must use the same action
* Do not implement fallback logic outside the core
* Do not copy logic into UI, API, or channel handlers

#########################
ENTRANCE RULE
#########################

Multiple entrances.

Single AMP Core.

Domains:

* app.da-nya.com
* test.da-nya.com
* test.pet-taxi-airport.com
* www.pet-taxi.tokyo

Do not create domain specific business logic.

Flow:

request
-> entrance/context.ts
-> auth
-> route
-> core
-> output

#########################
AUTH RULE
#########################

Flow:

request
-> auth/context.ts
-> auth/session.ts
-> auth/identity.ts
-> auth/route.ts
-> response

Rules:

* One authentication core
* Web, PWA, LIFF and LINE use the same authentication flow
* Resolve visitor_uuid before user_uuid
* Never create visitor_uuid from user_uuid
* Identity mapping must be centralized
* UI must not decide role
* UI must not decide tier
* API must not decide role
* API must not decide tier

#########################
SESSION RULE
#########################

Important

AMP does NOT use a sessions table.

Session exists only in runtime code.

Do not create:

* sessions table
* session repository
* session persistence layer

unless explicitly required.

Session is runtime state.

Database stores identity.

Code builds session.

Database does not store session.

Session maintains only:

* visitor_uuid
* user_uuid
* role
* tier
* identity_state
* source_channel
* current_room_uuid
* participant_uuid
* locale
* last_route
* overlay_state
* assistant_state

Session must not store business data.

Forbidden:

* reservation records
* driver application records
* chat message bodies
* notification bodies
* payment data
* review results
* UI fixed copy
* business rule outcomes

Business data comes from DB and core.

#########################
AUTH RESPONSIBILITY RULE
#########################

auth/context.ts

Responsibility:

* read cookie
* read header
* read liff
* read pwa
* read url
* normalize input only

Must not decide:

* role
* tier
* route

auth/session.ts

Responsibility:

* restore visitor_uuid
* create visitor_uuid
* restore runtime session
* attach user_uuid

auth/identity.ts

Responsibility:

* resolve line
* resolve google
* resolve email

Use identities table.

Do not leak provider logic.

auth/route.ts

Responsibility:

* role
* tier
* redirect
* entry routing

#########################
IDENTITY RULE
#########################

visitors = anonymous identity

users = authenticated identity

identities = provider mapping

session = runtime only

#########################
VISITOR RULE
#########################

visitors table stores only:

* visitor_uuid
* user_uuid
* source_channel
* created_at
* updated_at

Visitors table is identity only.

Forbidden:

* state
* status
* role
* tier
* locale
* notification settings
* business flags
* reservation state
* chat state

#########################
USER RULE
#########################

users table stores:

* role
* tier
* locale
* display_name

Do not duplicate these into session storage.

#########################
LOCALE RULE
#########################

* Supported locales are ja, en, es.
* Do not create locale routes.
* Do not create separate components per locale.
* Do not scatter translated text across JSX.
* Keep component text in one content object.
* Group text by key, not by locale.
* Use content.key[locale].
* Example:
  const content = {
    breadcrumb_home: {
      ja: 'ホーム',
      en: 'Home',
      es: 'Inicio',
    },
  }
* Render:
  content.breadcrumb_home[locale]
* Browser language is only used after client mount.
* Use stored locale first, browser language second, ja fallback third.
* Prevent hydration mismatch by using a stable initial locale before mount.

Supported locales:

* ja
* en
* es

Do not create locale routes.

Do not create locale specific pages.

Do not create separate components per locale.

Use a single component and switch text by locale.

Bad:

home-ja.tsx
home-en.tsx
home-es.tsx

Good:

home/page.tsx

#########################
LOCALE CONTENT RULE
#########################

Group text by key.

Do not group by locale.

Keep locale text together.

Do not scatter translated strings across JSX.

Use:

const content = {
home: {
ja: ‘ホーム’,
en: ‘Home’,
es: ‘Inicio’,
},
}

Render:

content.home[locale]

Never use:

locale === ‘ja’
? ‘ホーム’
: locale === ‘en’
? ‘Home’
: ‘Inicio’

#########################
LOCALE FLOW RULE
#########################

browser language
-> locale utility
-> locale provider
-> component
-> content.key[locale]

Do not bypass this flow.

#########################
LOCALE STORAGE RULE
#########################

Priority:

1. saved locale
2. browser locale
3. ja

Storage key:

amp_locale

#########################
HYDRATION RULE
#########################

Never read navigator.language during server render.

Never read localStorage during server render.

Browser locale detection must occur after client mount.

Prevent server/client text mismatch.

Never render locale dependent text on server if locale comes from browser state.

Use:

mounted
-> locale
-> render

Avoid:

server render
-> navigator.language

#########################
LOCALE RESPONSIBILITY RULE
#########################

locale utility

* resolves locale

locale provider

* stores locale state

component

* renders text only

API

* must not decide locale

business logic

* must not decide locale

#########################
CHAT RULE
#########################

All chats belong to a room.

One chat flow.

One message bundle.

Web chat bubbles and LINE Flex Messages must be generated from the same source.

Flow:

message
-> room
-> action
-> message_bundle
-> output

#########################
DATABASE RULE
#########################

Keep schema minimal.

Avoid duplicate tables.

Avoid duplicate ownership.

One source of truth per responsibility.

Examples:

users
= identity

drivers
= driver state

vehicles
= vehicle data

documents
= uploaded files

#########################
OUTPUT RULE
#########################

All outgoing messages must go through output core.

Flow:

message_bundle
-> output/rules.ts
-> output/index.ts
-> output/web.ts
-> output/line.ts

Do not send messages directly from:

* UI
* API
* chat logic

#########################
NAMING RULE
#########################

Use directory structure to express responsibility.

Do not repeat context in file names.

Good:

chat/action.ts
chat/rules.ts
driver/schedule.ts

Bad:

chat_action.ts
driver_schedule.ts

#########################
UI LOCK RULE
#########################

Header Color : LOCK

Footer Color : LOCK

Background Color : LOCK

Header Footer UI : LOCK

While lock is enabled:

* No header UI changes
* No footer UI changes
* No color changes
* No size changes
* No position changes
* No animation changes

Only bug fixes are allowed.

#########################
GOAL
#########################

Build once.

Keep one core.

Support:

* Web
* PWA
* LIFF
* LINE
* Admin
* Driver
* Concierge
* Bot

Keep code simple.

Keep file names simple.

Use directories to express responsibility.

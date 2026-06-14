<!-- BEGIN:nextjs-agent-rules -->

Next.js Rule

This project may use a newer Next.js version.

Always check:

node_modules/next/dist/docs/

before implementing framework specific features.

Do not rely on outdated Next.js assumptions.

<!-- END:nextjs-agent-rules -->

AMP v1

Core Principle

* One Build
* Single Core
* Multi Entrance
* One Source of Truth
* Shared logic is mandatory
* Every feature must pass through the core
* Do not duplicate business logic

⸻

Common Rules

* Use English only for code comments
* Use ASCII characters only in code comments
* Do not use emojis in code comments

⸻

Shared Core Rules

* All domains use the same database
* All domains use the same authentication system
* All domains use the same chat system
* All domains use the same match engine

Domains:

* app.da-nya.com
* test.da-nya.com
* test.pet-taxi-airport.com
* www.pet-taxi.tokyo

Multiple entrances.

Single AMP Core.

⸻

Architecture Rules

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

⸻

Core Usage Rules

* Shared logic is mandatory
* Every entry point must call the same core
* Web and LINE must use the same action
* Do not implement fallback logic outside the core
* Do not copy logic into UI, API, or channel handlers

⸻

Authentication Flow

request
-> auth/context.ts
-> auth/session.ts
-> auth/identity.ts
-> auth/route.ts
-> output

Rules:

* One authentication core
* Web, PWA, LIFF and LINE use the same authentication flow
* Resolve visitor_uuid before user_uuid
* Never create visitor_uuid from user_uuid
* Identity mapping must be centralized
* UI and API must not decide role or tier

Session Design

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

Forbidden in session:

* reservation records
* driver application records
* chat message bodies
* notification bodies
* payment data
* review results
* UI fixed copy
* business rule outcomes

Business data comes from DB / core / archive.

Resolution order:

request
-> auth/context.ts
-> auth/session.ts
-> auth/identity.ts
-> auth/route.ts
-> response

Responsibilities:

auth/context.ts
* read cookie / header / liff / pwa / url
* normalize input only
* no decisions

auth/session.ts
* restore or create visitor_uuid first
* restore session record
* attach user_uuid when logged in

auth/identity.ts
* resolve line / google / email identities
* do not leak provider logic to business code

auth/route.ts
* decide role, tier, entry point, redirect

Storage:

cookie:
* visitor_uuid
* session_token

DB:
* sessions
* visitors
* users
* identities
* room_participants

localStorage:
* avoid by default
* UI assist only if needed
* never use for auth or permission decisions

Session purpose:

Maintain who, from which entrance, with which role,
in which room, and in which UI state.

Session does not perform business decisions.
Business decisions belong in rules / core only.

Types live in core/auth/types.ts
Session record type is AmpSession

⸻

Entrance Flow

request
-> entrance/context.ts
-> auth
-> route
-> core
-> output

Domain Responsibilities:

app.da-nya.com
= application

test.da-nya.com
= corporate

test.pet-taxi-airport.com
= airport

www.pet-taxi.tokyo
= seo

Do not create domain specific business logic.

⸻

Chat Rules

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

⸻

Database Rules

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

⸻

Development Rules

* Optimize for simplicity
* Optimize for maintainability
* Optimize for performance
* Optimize for future automation
* Prefer lazy loading when possible

⸻

Naming Rules

Use directory structure to express responsibility.

Do not repeat context in file names.

Good:

chat/action.ts

chat/rules.ts

driver/schedule.ts

Bad:

chat_action.ts

driver_schedule.ts

⸻

Goal

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

* Keep code simple
* Keep file names simple
* Do not create complex file names
* Use directories to express responsibility

Good:

admin/user/list.ts
admin/user/detail.ts
admin/driver/list.ts
admin/driver/detail.ts

Bad:

admin_user_list.ts
admin_user_detail.ts
admin_driver_list.ts
admin_driver_detail.ts

Header Color : LOCK
Footer Color : LOCK
Background Color : LOCK
Header Footer UI : LOCK

App Shell Decoration Rules

Header and footer shape:

- border-radius only
- pseudo elements allowed when needed
- no SVG for shell decoration
- no clip-path
- no decorative images
- no ear or tail shapes

World view is expressed only through:

- beige color
- brown accent
- pink paw button (icon.svg or icon.webp)
- brown paw send button
- rounded UI
- dog and cat characters in content areas

While Header Footer UI lock is true:

- No header UI changes
- No footer UI changes
- No color changes
- No size changes
- No position changes
- No animation changes

Only bug fixes are allowed.

SESSION DESIGN

Important

AMP does NOT use a sessions table.

Session exists only in code.

Database:

* visitors
* users
* identities
* profiles

are the source of truth.

Do not create:

* sessions table
* session repository
* session persistence layer

unless explicitly required.

⸻

Session Flow

request
-> auth/context.ts
-> auth/session.ts
-> auth/identity.ts
-> auth/route.ts
-> response

⸻

auth/context.ts

Responsibility:

Normalize request only.

Input:

* cookie
* header
* liff
* pwa
* url

Do not decide:

* role
* tier
* route

⸻

auth/session.ts

Responsibility:

Build runtime session object.

Session is created per request.

Example:

type Session = {
visitor_uuid: string
user_uuid: string | null
source_channel: string
}

Do not persist session.

Do not write session records to database.

⸻

auth/identity.ts

Responsibility:

Resolve identity.

Sources:

* line
* google
* email

Use identities table.

Do not leak provider logic into business logic.

⸻

auth/route.ts

Responsibility:

Resolve:

* role
* tier
* redirect

Use users table.

Do not decide role in UI.

Do not decide role in API.

⸻

Visitors

visitors table stores:

* visitor_uuid
* user_uuid
* source_channel
* created_at
* updated_at

Nothing more.

⸻

Users

users table stores:

* role
* tier
* locale
* display_name

These values must not be duplicated into session storage.

⸻

Rule

Session is runtime state.

Database stores identity.

Code builds session.

Database does not store session.
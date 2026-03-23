# NightQuest — Agent Context

> Read this file first before touching any code.
> It tells you exactly what has been built, where things live, what the constraints are,
> and what checks must pass before every push.

---

## Project in One Sentence

A dark-sky stargazing planner: React Native Expo frontend + Python/Agno FastAPI backend.
Users browse celestial events, find nearby dark sky spots, check viewing conditions, and ask
an AI assistant for recommendations.

---

## Phase Status

| Phase | Description                    | Status         | Commit   |
|-------|--------------------------------|----------------|----------|
| 1     | Backend Foundation             | ✅ Complete    | —        |
| 2     | Explore Tab + Context Object   | ✅ Complete    | —        |
| 3A    | Stargaze Tab: Spot Finder      | ✅ Complete    | 3553d2e  |
| 3B    | Stargaze Tab: Conditions       | ✅ Complete    | —        |
| 4     | AI Chat                        | ✅ Complete    | —        |
| 5     | Full Integration + Polish      | 🔲 Pending     | —        |
| 6     | Travel Planning                | 🔲 Pending     | —        |
| 7     | Nice-to-Haves                  | 🔲 Optional    | —        |

---

## What Has Been Built

### Phase 1 — Backend Foundation
- `backend/api.py` — FastAPI app, CORS, `POST /api/events`, `GET /health`
- `backend/schemas.py` — all Pydantic models: `Location`, `CelestialEvent`, `DarkSpotSite`,
  `ConditionFactor`, `VisibilityConditions`, `ContextObject`, `ChatRequest/Response`,
  `EventsRequest/Response`, `SpotsRequest/Response`, `ConditionsRequest/Response`
- `backend/sub_agents/celestial_events/tools.py` — `get_events_for_year()` wrapping `astronomy-engine`
- `backend/sub_agents/celestial_events/agent.py` — Agno Agent definition
- `backend/sub_agents/weather_conditions/agent.py` — stub (Phase 3B)
- `backend/sub_agents/weather_conditions/tools.py` — stub (Phase 3B)
- `backend/data/dark_sky_sites.json` — 200–400 IDA-certified dark sky sites (lat, lon,
  bortle_estimate, certified, website, country, state)
- `backend/requirements.txt`, `backend/Procfile`, `backend/runtime.txt`

### Phase 2 — Explore Tab + Context Object
- `frontend/constants/theme.ts` — all color/typography/spacing/breakpoint tokens
  (Atacama Desert Night theme B; never hardcode colors — always reference theme)
- `frontend/store/context.ts` — Zustand store with full `ContextObject` + all setters +
  `applyContextUpdates()` (straight replace, no merging)
- `frontend/components/shared/StarBackground.tsx` — three-tier fixed star field layer
- `frontend/components/shared/LocationPicker.tsx` — GPS → IP → timezone → manual chain;
  exports `useAutoDetectLocation` hook
- `frontend/app/_layout.tsx` — root layout, `StarBackground`, web `WebHeader`, `Stack` nav
- `frontend/app/(tabs)/_layout.tsx` — custom `TabBar` (mobile/tablet), bottom chat button stub
- `frontend/app/(tabs)/explore.tsx` — full Explore screen with year selector, filter pills,
  month-grouped event calendar, show-past toggle
- `frontend/app/event-detail.tsx` — route wrapper parsing `data` param → `EventDetail`
- `frontend/components/explore/EventCard.tsx` — event card per style guide
- `frontend/components/explore/EventDetail.tsx` — detail screen; "Find Dark Skies" sets
  `context.active_event + context.date`, switches to Stargaze tab
- `frontend/components/explore/MonthSection.tsx` — collapsible month group
- `frontend/services/api.ts` — all API calls; `fetchEvents`, `fetchSpots`, `fetchChat`,
  `fetchPrompts`; base URL from `EXPO_PUBLIC_API_URL`

### Phase 3B — Stargaze Tab: Conditions
- `backend/sub_agents/weather_conditions/tools.py` — `weather_tool`: Open-Meteo forecast (≤16 days)
 + ERA5 archive averages (>16 days), derives all 8 factors, moon via astronomy-engine, rule-based ai_take
- `backend/sub_agents/weather_conditions/agent.py` — Agno Agent wrapping weather_tool for Phase 4 chat
- `backend/api.py` — added `POST /api/conditions`; updated `POST /api/spots` to fetch conditions in
 parallel (asyncio.gather) and re-rank by composite score
- `backend/schemas.py` — `ConditionsSummary` model added; `DarkSpotSite` extended with
 `conditions_summary` + `address` fields
- `backend/scripts/enrich_addresses.py` — one-time Nominatim reverse geocoding script to enrich
 `dark_sky_sites.json` with `address: "region, country"` field; 1s delay, skips sites with good
 state+country already set
- `frontend/services/api.ts` — `fetchConditions()` + `ConditionFactor`, `MoonInfo`,
 `ConditionsResponse` types added
- `frontend/store/context.ts` — `ConditionsSummary` interface + `address` field in `DarkSpotSite`
- `frontend/components/stargaze/ConditionsRow.tsx` — single condition factor row; icon, name,
 score/max pill, progress bar, detail text; left border accent = status color
- `frontend/components/stargaze/SpotDetail.tsx` — full detail screen: score ring (SVG web, native
 view), 8 factor rows via ConditionsRow, expandable score breakdown, moon section, Getting There
 with platform-aware directions (iOS/Android native maps, web Google Maps), AI Take section,
 historical averages banner, two-column web layout
- `frontend/app/spot-detail.tsx` — delegates to SpotDetail.tsx (stub replaced)
- `frontend/components/stargaze/SpotCard.tsx` — condition icon placeholders replaced with real
 status-colored icons from conditions_summary; `selected` prop added for highlighted state
- `frontend/components/stargaze/SpotMap.tsx` — bidirectional map/list interaction fixed:
 pin tap → summary card + list scroll + highlight; list tap → pin highlight + switch to map view
 (native); web layouts use ScrollView ref for programmatic scroll on selectedIdx change
- `e2e/fixtures/conditions-mock.json` — deterministic mock conditions payload (15 tests)
- `e2e/fixtures/spots-mock.json` — updated with conditions_summary + address fields
- `e2e/fixtures/base.ts` — intercepts `POST /api/conditions` with mock payload
- `e2e/tests/spot-detail.spec.ts` — 14 tests covering Phase 3B validation criteria
- `backend/sub_agents/dark_sky_location/tools.py` — `distance_tool` (haversine),
  `dark_sky_lookup_tool` (load JSON, filter, rank Bortle 60% + distance 40%)
- `backend/sub_agents/dark_sky_location/agent.py` — Agno Agent definition
- `backend/api.py` — added `POST /api/spots` (structured mode, calls tools directly)
- `backend/schemas.py` — `DarkSpotSite` extended with `distance`, `score`, `rank` fields
- `frontend/components/shared/DatePicker.tsx` — prev/next day arrows; historical averages
  label when date is >16 days from today
- `frontend/components/stargaze/SpotCard.tsx` — rank, score box, Bortle tag, IDA certified
  badge, placeholder condition icons (filled Phase 3B), View Details CTA
- `frontend/components/stargaze/SpotMap.tsx` — `react-native-maps` on native (numbered pins,
  pulsing user dot, slide-up summary card on pin tap, list/map toggle); web fallback list view
- `frontend/app/(tabs)/stargaze.tsx` — full Stargaze screen; date + location header;
  What's Visible Tonight section (MVP static); Find Dark Skies → distance modal → SpotMap;
  pre-fill + auto-search when `context.active_event` is set (arriving from Explore)
- `frontend/store/context.ts` — `DarkSpotSite` extended with `distance`, `score`, `rank`
- `frontend/services/api.ts` — `fetchSpots()` added

### Phase 4 — AI Chat
- `backend/orchestrator.py` — Agno Team (coordinate mode) with all 3 sub-agents; `chat()` async
  entry point; context preamble injected into every request; `<context_update>` block parsed from
  response to detect context changes; ACTION line format for inline action cards
- `backend/api.py` — `POST /api/chat` (calls orchestrator.chat, returns ChatResponse);
  `GET /api/prompts` (pure-Python context-driven prompts, 3-4 per context state)
- `backend/schemas.py` — `PromptsResponse` model added
- `frontend/store/chat.ts` — minimal Zustand store for `isOpen` (open/close/toggle)
- `frontend/components/chat/ActionCard.tsx` — tappable card for `view_stargaze` and `view_spot`
  action types; parsed inline from AI message content
- `frontend/components/chat/MessageBubble.tsx` — user (right, accent) / AI (left, surface) bubbles;
  parses `[ACTION:type:label]` lines and renders ActionCard; star icon on first AI message
- `frontend/components/chat/SuggestedPrompts.tsx` — chips from `GET /api/prompts`; disappear on
  first send, reappear on context key change; non-fatal on fetch error
- `frontend/components/chat/ChatSheet.tsx` — Reanimated v4 bottom sheet (mobile/tablet, 90% height,
  drag-to-dismiss with startY tracking); persistent right side panel (web ≥1280px, resizable
  280–700px by dragging left edge, snap expand/collapse toggle); context-aware subtitle;
  local chat history state; calls `applyContextUpdates` on context_updated; Enter-to-send on web
  (Shift+Enter inserts newline); themed scrollbar on chat input
- `frontend/app/_layout.tsx` — `GestureHandlerRootView` wraps entire app; web layout restructured
  to flex row (Stack + ChatSheet side panel); mobile ChatSheet rendered as overlay outside SafeAreaView;
  web header "Ask AI" button wired to `useChatUIStore.open()`
- `frontend/app/(tabs)/_layout.tsx` — mobile chat button wired to `useChatUIStore.open()`
- `e2e/fixtures/chat-mock.json` — mock `/api/chat` response with action card
- `e2e/fixtures/prompts-mock.json` — mock `/api/prompts` response (4 prompts)
- `e2e/fixtures/base.ts` — interceptors added for `POST /api/chat` and `GET /api/prompts**`
- `e2e/tests/chat.spec.ts` — 13 tests covering Phase 4 validation criteria
- `e2e/playwright.config.ts` — three viewports: web (1280px), tablet (820px), mobile (390px)
- `e2e/fixtures/base.ts` — `appPage` fixture: mocks geolocation + `POST /api/events` +
  `POST /api/spots` + `GET /health`; all tests use mocks, no live backend needed
- `e2e/fixtures/events-mock.json` — deterministic mock events payload
- `e2e/fixtures/spots-mock.json` — deterministic mock spots payload (3 spots)
- `e2e/tests/navigation.spec.ts` — app shell, tab switching
- `e2e/tests/explore.spec.ts` — year selector, filters, event list, error state
- `e2e/tests/event-detail.spec.ts` — event detail navigation, back button
- `e2e/tests/stargaze.spec.ts` — full Phase 3A validation (20 tests)

### Phase 4 Polish — AI Chat Quality + Branding

#### AI Chat fixes
- `backend/orchestrator.py` — `_clean_orchestrator_noise()` strips Agno coordinator delegation
  JSON (`{"member_id":...}`) and "Delegating…" lines from responses; off-topic guardrail added
  to `_CHAT_INSTRUCTIONS`; no-markdown, conversational tone, 3–5 sentence instructions added;
  `make_chat_orchestrator()` now passes `today = date.today().isoformat()` to all sub-agent factories
- `backend/api.py` — `_is_astronomy_related()` input-side classifier (gpt-4o-mini, max_tokens=3,
  temperature=0) runs before the orchestrator and returns a polite decline for off-topic messages;
  exceptions propagate naturally (no fail-open)
- `backend/sub_agents/celestial_events/tools.py` — `astronomy_tool` gains `start_date: str | None`
  param (defaults to today); filters all returned events to `>= cutoff` date
- `backend/sub_agents/celestial_events/agent.py` — factory accepts `today: str`; first instruction
  injects today's date; instructs agent to always pass `start_date=today`; `markdown=False`
- `backend/sub_agents/dark_sky_location/agent.py` — same `today` injection; `markdown=False`
- `backend/sub_agents/weather_conditions/agent.py` — same `today` injection; instructs agent to
  use today when no date specified; `markdown=False`

#### Branding
- `frontend/components/shared/LogoMark.tsx` — new reusable brand component; sizes sm/md/lg;
  web renders `/favicon.svg` via `<Image>`; native falls back to styled ✦ view; props:
  `size`, `showName`, `showTagline`, `tagline` (default: "Your night sky awaits")
- `frontend/public/favicon.svg` — 32×32 ringed planet SVG: dark rounded rect, amber planet
  gradient, 3 paired ring ellipses (light/dark gap/light) with back/front clip-path depth trick
- `frontend/assets/logo.svg` — full 440×120 horizontal wordmark: planet mark (100×100) +
  "NightQuest" in Space Grotesk + tagline in DM Sans
- `frontend/app/+html.tsx` — `<title>NightQuest — Your night sky awaits</title>`; meta
  description updated; `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`
- `frontend/app.json` — removed `web.favicon` key so Expo no longer injects the old
  `assets/favicon.png` link that was overriding the SVG favicon from `+html.tsx`
- `frontend/app/_layout.tsx` — web nav bar uses `<LogoMark size="sm" showName showTagline />`
- `frontend/app/(tabs)/explore.tsx` — mobile screen header uses `<LogoMark size="sm" showName />`
- `frontend/components/chat/ChatSheet.tsx` — empty chat state uses
  `<LogoMark size="lg" showName showTagline />`

#### Layout / scroll fixes
- `frontend/app/_layout.tsx` — container changed from `minHeight: '100vh'` to
  `height: '100vh' + overflow: hidden` on web; fixes mobile web full-page scroll so inner
  ScrollViews are the scroll container and all screen headers stay pinned
- `frontend/app/(tabs)/explore.tsx` — screen header hidden on web (≥1280px) where WebHeader
  already handles branding; wrapped in `width < breakpoints.web` guard
- `frontend/app/(tabs)/stargaze.tsx` — same web header guard; added `isWeb` derived value

#### AI Chat quality fixes (post-launch)
- `backend/api.py` — `_is_astronomy_related()` now accepts `history: list = None`; passes last
  3 messages to classifier so short follow-ups ("yes", "ok") are not blocked; classifier prompt
  updated: conversational replies always pass when prior astronomy context exists;
  `post_chat` passes `request.history` to the classifier
- `backend/orchestrator.py` — `_CHAT_INSTRUCTIONS` fully rewritten with 8 canonical rules in
  priority order: (1) absolute no-markdown, (2) astronomy-only scope, (3) clarifying questions
  for vague queries, (4) direct answers when context sufficient, (5) 3–5 sentence max,
  (6) always call Dark Sky Agent before claiming no spots / retry at 300km,
  (7) mandatory `[ACTION:view_stargaze:View dark sky spots]` line when spots returned,
  (8) night sky questions → call Celestial Events Agent immediately
- `backend/sub_agents/dark_sky_location/agent.py` — explicit instruction to default
  `max_distance_km=200` when user has not specified a distance
- `frontend/components/chat/MessageBubble.tsx` — store `line.trim()` in action segment so
  anchored regex label extraction works even if LLM emits leading whitespace
- `frontend/components/chat/ChatSheet.tsx` — `view_stargaze` action card now also calls
  `setTriggerSpotSearch(true)` and `setTab('stargaze')` before navigating
- `frontend/store/context.ts` — added `trigger_spot_search: boolean` (UI-only flag, not part
  of `ContextObject`, not reset by `applyContextUpdates`) + `setTriggerSpotSearch` setter
- `frontend/app/(tabs)/stargaze.tsx` — `useEffect` watches `trigger_spot_search`; auto-calls
  `doSearch` when flag is set then resets it; default `distanceKm` changed from 80 to 200

---

## What Is Stubbed / Not Yet Built

| File | Status |
|------|--------|
| `backend/sub_agents/weather_conditions/tools.py` | ✅ Complete — Phase 3B |
| `backend/sub_agents/weather_conditions/agent.py` | ✅ Complete — Phase 3B |
| `backend/orchestrator.py` | ✅ Complete — Phase 4 + Polish |
| `POST /api/chat` | ✅ Live — Phase 4 |
| `GET /api/prompts` | ✅ Live — Phase 4 |
| `frontend/components/chat/ChatSheet.tsx` | ✅ Complete — Phase 4 + Polish |
| `frontend/components/chat/MessageBubble.tsx` | ✅ Complete — Phase 4 |
| `frontend/components/chat/SuggestedPrompts.tsx` | ✅ Complete — Phase 4 |
| `frontend/components/chat/ActionCard.tsx` | ✅ Complete — Phase 4 |
| `frontend/components/shared/LogoMark.tsx` | ✅ Complete — Phase 4 Polish |
| `frontend/public/favicon.svg` | ✅ Complete — Phase 4 Polish |
| SpotCard condition icons | ✅ Real status-colored icons — Phase 3B |
| SpotDetail "View Details" navigation | ✅ Navigates to `/spot-detail` — Phase 3B |

---

## Architecture Rules (Never Violate)

1. **No hardcoded colors** — always use `colors.*` from `frontend/constants/theme.ts`
2. **Timezone is always backend-derived** — frontend never calculates timezone; send lat/lon,
   receive timezone in response
3. **Context object is a straight replace** — `applyContextUpdates(ctx)` replaces the entire
   object; never merge partial updates
4. **Chat history is local component state** — not in Zustand, not in context object
5. **Frontend calls only through `services/api.ts`** — no raw `fetch` in components
6. **Structured endpoints call tools directly** — no Agno agent roundtrip for deterministic
   endpoints; agents are for chat mode only
7. **No OpenWeatherTools** — custom Open-Meteo tool only (no API key, 16-day forecast)
8. **Star background is a fixed layer** — does not scroll; rendered in `app/_layout.tsx`
9. **Explore date range filter is frontend-only** — never sent to backend, never in context
10. **`context_updated: false` → ignore context field** — only replace when `true`

---

## API Contract (All Endpoints)

Base URL: `EXPO_PUBLIC_API_URL` env var (default `http://localhost:8000`)

### POST /api/events ✅ Live
```
Request:  { location: Location, year: int, filters: EventType[] }
Response: { events: CelestialEvent[], generated_at: string }
```

### POST /api/spots ✅ Live
```
Request:  { location: Location, date: string, event_type?: string, distance_km?: float }
Response: { spots: DarkSpotSite[] }   // each spot has distance, score, rank fields
```

### POST /api/conditions ✅ Live
```
Request:  { spot: { lat, lon }, date: string, timezone: string }
Response: { score: int, label: string, factors: ConditionFactor[], moon: object,
            ai_take: string, data_type: "forecast"|"historical_average" }
```

### POST /api/chat ✅ Live
```
Request:  { message: string, history: ChatMessage[], context: ContextObject }
Response: { reply: string, context_updated: bool, context: ContextObject }
```

### GET /api/prompts ✅ Live
```
Request:  context fields as query params (tab, location, event, spot)
Response: { prompts: string[] }
```

---

## Context Object Shape

```typescript
{
  tab: "explore" | "stargaze",
  location: { lat, lon, name?, source?, timezone? } | null,
  date: string | null,                  // single ISO date "YYYY-MM-DD"
  active_event: { name, date, type } | null,
  spots: DarkSpotSite[],
  active_spot: { name, lat, lon, bortle?, distance?, certified?, website? } | null,
  visibility_conditions: { available, for_date?, for_location? } | null,
}
```

Key setters in `store/context.ts`: `setTab`, `setLocation`, `setDate`, `setActiveEvent`,
`setSpots`, `setActiveSpot`, `setVisibilityConditions`, `applyContextUpdates`.

---

## Key File Map

```
nightquest/
├── backend/
│   ├── api.py                    ← add new endpoints here
│   ├── schemas.py                ← single source of truth for all data shapes
│   ├── orchestrator.py           ← stub; Phase 4 Agno Team
│   └── sub_agents/
│       ├── celestial_events/     ← ✅ complete
│       ├── dark_sky_location/    ← ✅ complete (3A)
│       └── weather_conditions/   ← 🔲 stub (3B)
├── frontend/
│   ├── app/
│   │   ├── _layout.tsx           ← root layout, StarBackground, WebHeader
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx       ← custom TabBar, chat button stub
│   │   │   ├── explore.tsx       ← ✅ complete
│   │   │   └── stargaze.tsx      ← ✅ complete (3A)
│   │   └── event-detail.tsx      ← ✅ complete
│   ├── components/
│   │   ├── explore/              ← ✅ complete
│   │   ├── stargaze/             ← SpotCard ✅, SpotMap ✅; SpotDetail 🔲 (3B)
│   │   ├── chat/                 ← ✅ Phase 4 complete
│   │   └── shared/
│   │       ├── StarBackground.tsx ← ✅
│   │       ├── LocationPicker.tsx ← ✅
│   │       ├── DatePicker.tsx    ← ✅ (3A)
│   │       └── LogoMark.tsx      ← ✅ (4 Polish) planet mark + wordmark + tagline
│   ├── constants/theme.ts        ← single source for all design tokens
│   ├── store/context.ts          ← Zustand context store
│   ├── services/api.ts           ← all API calls live here
│   ├── public/favicon.svg        ← ✅ SVG planet mark; served at /favicon.svg by Metro
│   └── assets/logo.svg           ← ✅ full horizontal wordmark SVG (reference asset)
└── e2e/
    ├── playwright.config.ts
    ├── fixtures/
    │   ├── base.ts               ← appPage fixture; add new route mocks here
    │   ├── events-mock.json
    │   └── spots-mock.json
    └── tests/                    ← add a new spec per phase
```

---

## Pre-Push Checklist

Run all of the following from the project root before every commit. Fix any **errors** before
pushing. Warnings in pre-existing Phase 2 files (`_layout.tsx`, `explore.tsx`,
`LocationPicker.tsx`) are known and do not block — do not add new ones.

### 1. Frontend TypeScript
```bash
cd frontend && npx tsc --noEmit
```
Must exit 0. Fix all type errors before pushing.

### 2. Frontend ESLint
```bash
cd frontend && npx eslint .
```
Must exit 0 (no errors). Warnings are tolerated only in pre-existing Phase 2 files.
New files must be warning-free.

### 3. E2E TypeScript
```bash
cd e2e && npx tsc --noEmit
```
Must exit 0. Fix all type errors before pushing.

### 4. E2E ESLint
```bash
cd e2e && npx eslint .
```
The two pre-existing `playwright/no-networkidle` errors in `explore.spec.ts` are known.
New test files must be error-free and warning-free.

### 5. Tests
Every phase must add tests. Rules:
- Add a `e2e/tests/<phase>.spec.ts` covering all validation criteria from the implementation plan
- Add mock fixture data to `e2e/fixtures/` for any new API endpoint mocked in `base.ts`
- Update `e2e/fixtures/base.ts` to intercept any new `POST /api/*` or `GET /api/*` routes
- Tests run against the Expo web build — `react-native-maps` is not available on web;
  test the web list/fallback view, not the native map
- Do not use `waitForLoadState('networkidle')` — it is flagged by the linter

### 6. Backend Python syntax check
```bash
cd backend && python -m py_compile api.py schemas.py \
 sub_agents/celestial_events/tools.py \
 sub_agents/dark_sky_location/tools.py \
 sub_agents/dark_sky_location/agent.py \
 sub_agents/weather_conditions/tools.py \
 sub_agents/weather_conditions/agent.py \
 scripts/enrich_addresses.py
```
Add any new `.py` files to this list. No output = no syntax errors.

---

## Adding a New Phase — Checklist

1. **Read the implementation plan** for that phase's deliverables before writing any code
2. **Backend first**: schemas → tools → agent → endpoint in `api.py`
3. **Frontend**: update `services/api.ts` → update `store/context.ts` if shape changes →
   build components → build screen
4. **Never add a new Stack.Screen** in `_layout.tsx` without the corresponding route file
5. **Update this file**: add the new phase to "What Has Been Built" and mark stubs as complete
6. **Update README.md** phase status table
7. **Run the full pre-push checklist** — fix all errors before committing

---

## Design Token Quick Reference

```typescript
// Import pattern (always destructure from theme)
import { colors, spacing, borderRadius, typography, breakpoints } from '@/constants/theme';

// Background hierarchy
colors.background.base       // #050508 — behind star field
colors.background.primary    // #080B18 — screen background
colors.background.surface    // #110D0A — cards
colors.background.elevated   // #1A1310 — modals, sheets

// Accents
colors.accent.primary        // #D4780A — CTAs, active states (Desert Amber)
colors.accent.secondary      // #C2622D — secondary actions
colors.celestial.ai          // #A78BFA — AI/chat elements
colors.celestial.glow        // #FDE68A — star glow, moon

// Status
colors.status.good           // #86EFAC
colors.status.moderate       // #FDE68A
colors.status.poor           // #F87171

// Breakpoints
breakpoints.mobile = 375
breakpoints.tablet = 768     // isTabletOrWeb = width >= breakpoints.tablet
breakpoints.web    = 1280    // isWeb = width >= breakpoints.web
```

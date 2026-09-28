# DawaiSathi Product Requirements

## Problem statement
Build a mobile app: “I want to make this apps interface smooth and more simpler.” DawaiSathi is a medicine reminder app that reminds users to take medicines based on times set in the app. The user then asked for a full redesign around four tabs, a global Attention Center bell, and a global add action, while preserving existing functionality.

## Architecture

### Bottom navigation
- **Today** – What do I need to do today?
- **Care** – What am I managing?
- **History** – What happened?
- **Settings** – How is the app configured?

Global actions available above the tabs:
- Notification bell → Attention Center bottom sheet
- Plus button → Add sheet (Add medicine, Scan prescription, Upload prescription, Add checkup)

### Layers
- **Level 1 – Glance:** Today row shows medicine, dosage, instruction, time, status pill.
- **Level 2 – Understand:** Medicine detail bottom sheet with schedule, current status, dose history, next dose, contextual actions.
- **Level 3 – Manage:** Care sub-pages for members, medicine library, calendar, checkups, prescription flow, family management.

## Backend
- FastAPI + MongoDB.
- Endpoints: `/api/members`, `/api/medicines`, `/api/today`, `/api/medicines/{id}/dose`, `/api/doses/history`, `/api/medicines/{id}/refill`, `/api/medicines/{id}/restore`, `/api/checkups`, `/api/upcoming-checkup`, `/api/attention`, `/api/notifications/preferences`.
- Auto-seeds a primary member on startup and prevents its removal.
- `today` merges medicines assigned to the selected member with shared medicines (no member).
- `attention` aggregates missed doses, late doses, low-stock refills, and upcoming checkups.

## Frontend
- Expo Router + React Native with the shared theme in `frontend/src/theme.ts`.
- Shared components: `AppHeader`, `AttentionCenter`, `AddSheet`, `MemberSelector`, `BottomSheet`, `MedicineDetailSheet`, `StatusPill`, `ScreenShell`.
- Data flows through `DataProvider` with persistent active-member selection in local storage.

## Implemented

### 2026-09-28 — Solid teal green palette + cleaner surfaces
- Retuned `src/theme.ts` to a solid teal green identity (brand `#0F766E`, secondary `#14B8A6`, tertiary `#D6F1EC`) with softer teal-tinted surfaces (`#FBFDFC` canvas, `#F1F6F4` cards, `#EAF1EE` dividers) and a calmer muted (`#7C8E8B`).
- Added `infoTint` / `onInfoTint` tokens to keep semantic info banners (Upcoming checkup card, Locked dose banner) neutrally blue instead of clashing with the brand.
- Removed the two remaining hardcoded hex fills (`#E1EAF4` upcoming-checkup icon in Today, `#E4ECF2` locked banner in medicine detail sheet) — both now read from the theme.
- Semantic status pills (Locked/Late/Missed/Taken) stay unchanged to preserve status legibility.

### 2026-09-28 — DawaiSathi architectural redesign
- Restructured navigation to Today / Care / History / Settings with a global Attention Center bell and global + FAB.
- Added members, checkups, refill, undo dose, attention aggregation, and notification preferences to the backend.
- Rebuilt Today with member selector, upcoming checkup card (only when relevant), compact progress bar, and doses grouped by Morning / Afternoon / Evening / Night with status pills and detail bottom sheet.
- Added Care hub with Family (members), Care tools (Medicines, Schedule, Prescription), and Family management sections.
- Added Care sub-routes for family, medicine library (search + Active/Archived + Refill), calendar (month grid with dots + selected-day list), checkups (upcoming/past), prescription workflow (scan/upload + AI review steps), and family-management.
- Rebuilt History with adherence card and horizontal-scroll filter chips (member, medicine, date-range, status).
- Reorganised Settings into Account / Notifications / Integrations / Family & Privacy / App / About with backend-persisted preferences.
- Extended Add Medicine with member assignment, weekday selection, and identification cue; added Add Checkup modal.
- Verified with 10/10 backend pytest and full 390x844 mobile regression via testing agent; no APIs mocked.

## Backlog

### P0 — next core work
- Wire native camera & image picker into the prescription flow with permission handling.
- Add LLM-based prescription extraction (Claude Sonnet 5 or GPT-5 vision) driven by the Emergent LLM key.
- Add native scheduled reminders and permission onboarding.

### P1 — important follow-ups
- Google auth, WhatsApp, and Telegram integrations behind the Settings toggles.
- Family invitations, join requests, roles, and permissions plugging into Care > Family management.
- Offline dose logging with background sync.

### P2 — polish
- Adherence trends, refill projection, and per-medicine analytics.
- Custom timezone / language configuration.
- Eye-drop protocols, voice notes, medicine images end-to-end.

## Next task list
1. Integrate native camera capture + image picker into `/care/prescription`.
2. Add AI extraction via `integration_expert` playbook for Anthropic/OpenAI vision.
3. Wire native local notifications for reminder times with proper permission flow.

# DawaiSathi Product Requirements

## Problem statement
Build a mobile app: “I want to make this apps interface smooth and more simpler.” DawaiSathi is a medicine reminder app that reminds users to take medicines based on times set in the app.

## Architecture
- Expo SDK 57 React Native frontend with Expo Router bottom tabs.
- FastAPI backend bound through the configured backend URL with `/api` routes.
- MongoDB stores active medicines and dose logs; all API responses use string IDs and Pydantic models without MongoDB `_id` leakage.
- Light, minimal UI uses the shared token system in `frontend/src/theme.ts` and safe-area insets.

## User personas
- A patient who wants a low-effort daily medicine schedule.
- A caregiver who needs a quick view of medicines, dose completion, and history.

## Core requirements (static)
- View today’s medicine schedule and completion progress.
- Add and edit medicine name, dosage, frequency, reminder times, quantity, and instructions.
- Mark a scheduled dose as taken.
- Browse/search active medicines and archive medicines.
- Review logged dose history with time filters.
- Keep reminder and sound preferences easy to find.
- Use a bright, calm interface with simple navigation, large touch targets, clear states, and preserved current color direction.

## Implemented

### 2026-09-23 — Simplified DawaiSathi MVP
- Replaced the starter image screen with Today, Medicines, History, Settings, and Add/Edit Medicine flows.
- Added live FastAPI/MongoDB medicine CRUD, today schedule generation, dose logging, quantity decrement, and history endpoints.
- Added empty, loading, error, validation, search, progress, and success states with safe-area-aware mobile layouts.
- Added API environment fallback support for `EXPO_BACKEND_URL` and the configured `EXPO_PUBLIC_BACKEND_URL`.
- Added accessibility/test selectors for history filters and settings switches.
- Verified with live curl CRUD/dose flows, lint, and mobile regression testing at 390x844.

## Prioritized backlog

### P0 — next core work
- Add native scheduled notifications and permission onboarding for each saved reminder time.
- Reconcile and migrate the uploaded APK’s family workspace, inbox, and shared dose flows into the simplified navigation without crowding Today.

### P1 — important follow-up
- Add prescription scan/upload and a review-before-save medicine extraction flow.
- Add caregiver/family membership, invites, approvals, and per-member history.
- Persist notification sound/reminder preferences in the backend or secure device storage.

### P2 — polish
- Add adherence trends and refill alerts.
- Add configurable reminder windows and timezone-aware scheduling.
- Add a friendly first-run explanation and optional profile setup.

## Next task list
1. Implement native notification scheduling with safe rescheduling after medicine edits.
2. Add family/inbox routes from the uploaded APK behind a simple “Care circle” entry point.
3. Add prescription scan review and preserve manual editing before saving.
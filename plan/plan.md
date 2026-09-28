# DawaiSathi — Care Circle, Reminders & Claude Adherence Summary

DawaiSathi is a medicine reminder mobile app. This phase adds native reminder notifications, a family Care Circle with roles, and an AI-generated daily adherence summary powered by Claude Sonnet 5.

## Who it's for
- Patients who want reliable, easy medicine reminders.
- Family caregivers who need visibility into what their loved one has taken, missed, or is due to take next.

## Core features and experience

### Native reminder notifications
- Local push notifications are scheduled for every reminder time on every active medicine.
- Each notification says "Time for [medicine name]" and shows Taken and Snooze actions directly on the notification.
- Taken logs the dose immediately without opening the app.
- Snooze reschedules the reminder for 10 minutes later, up to two times per dose.
- If a dose is not marked Taken within 30 minutes of its scheduled time, it is marked missed and a caregiver alert notification is sent to every caregiver in the Care Circle who has enabled that alert.
- Notifications, permission flows, and background handling are only exercised on real devices via generated builds; Expo Go and the web preview cannot fully test them.

### Care Circle with roles
- A patient owns their medicines and dose history.
- A patient can invite family members using an in-app shareable invite code or link.
- Each member joins with a role: Patient, Caregiver, or Admin.
- Roles have clear capabilities:
  - Patient: full control of their own medicines, doses, and Care Circle members.
  - Caregiver: view schedule and history, receive missed-dose alerts, send a gentle reminder nudge.
  - Admin: same as Caregiver plus can remove members and edit Care Circle settings.
- The patient must approve every join request before the member gains access.
- A member can leave the Care Circle at any time and the patient can remove any member.
- All shared data is limited to medicine names, dosages, times, adherence records, and the summary text — never raw notes or sensitive identifiers beyond what the patient chose to enter.

### Care Circle chat with Claude Sonnet 5 daily summary
- A single chat entry lives inside the Care Circle area, labelled "Sathi daily summary".
- Once per day, or when opened, it produces a short, warm, plain-language summary of the patient's adherence for the previous 24 hours: what was taken on time, what was late, what was missed, and one supportive next step.
- Only the current day's dose events, medicine names, and dosages are sent to Claude. No names, emails, phone numbers, or free-text notes are included.
- The summary is generated on the backend using the Anthropic-provided API key.
- Every response includes a safety line: DawaiSathi is not medical advice; contact a clinician for medical decisions.
- Every Care Circle member can read the summary; only the patient can regenerate it.
- The chat is a summary feed, not a free-form conversation, to keep medical safety boundaries firm in this phase.

## User flow
1. Patient opens the app and sees Today, Medicines, History, Settings, and a new Care Circle tab.
2. On first launch, the app requests notification permission with a short benefit-led explanation.
3. Patient adds a medicine; reminders are automatically scheduled at each saved time.
4. When a reminder fires, the patient taps Taken from the notification or from Today.
5. If a dose is missed, a caregiver alert notification is delivered to opted-in caregivers.
6. Patient opens Care Circle, taps Invite, and shares the code with a family member.
7. Family member installs the app, enters the code, chooses a role, and waits for patient approval.
8. Once approved, the caregiver sees the patient's schedule, history, and the Sathi daily summary.
9. Opening the Sathi daily summary shows the latest AI-generated adherence recap with a supportive next step.

## UI/UX feel
- Minimal, bright, calm, iOS-native clean look; existing tokens and green accent stay intact.
- Native tabs on iOS 26+, standard bottom tabs elsewhere; Care Circle added as a fifth destination.
- Large touch targets, ample spacing, sticky primary actions on forms, and clear loading, empty, and error states.
- Notifications, invite flows, and the summary card use the same rounded, generous card style as Today.
- The Sathi summary card visually signals AI content with a small badge and includes the safety line at the bottom in muted text.

## Implementation phases

### Phase 1 — MVP (built now)
- Native local notifications for every scheduled reminder time with Taken and Snooze actions.
- Missed-dose detection at 30 minutes and caregiver alert notifications to opted-in caregivers.
- Care Circle tab with invite code flow, role selection, patient approval, member list, and remove/leave actions.
- Shared visibility of medicine list, today's schedule, and dose history within the Care Circle.
- Sathi daily summary powered by Claude Sonnet 5 using the Anthropic-provided API key, generated on the backend with strict data minimization and safety line.
- Notification permission onboarding, safe-area-aware Care Circle screens, and reliable error states.

### Phase 2 — Important follow-ups (not built now)
- Prescription scanning with camera and PDF upload, extraction review before saving, and manual edit fallback.
- Configurable snooze durations, missed-dose threshold, and quiet hours.
- Push notifications delivered when the app is fully closed on Android via a managed notifications service.
- Refill low-stock alerts sent to caregivers.
- Adherence trends across days and weekly digest.

### Phase 3 — Polish (not built now)
- Rich Sathi conversations with guarded, non-diagnostic Q&A about medicines already in the cabinet.
- Localization and larger accessible text presets.
- Optional profile setup with timezone and preferred reminder tone.
- Care Circle activity feed with member actions and audit trail.

## Assumptions
- Snooze duration is 10 minutes with a maximum of two snoozes per dose.
- A dose is considered missed 30 minutes after its scheduled time if not marked Taken.
- Caregiver missed-dose alerts default to on for every caregiver, with an opt-out available in Settings.
- Invites use a short shareable code and require patient approval before granting access.
- A patient can be in exactly one Care Circle at a time; caregivers and admins can be in several.
- The patient's role is fixed to Patient in their own Care Circle and cannot be transferred in this phase.
- Only medicine names, dosages, reminder times, and dose events are sent to Claude; no personal identifiers.
- Claude Sonnet 5 model is used for the daily summary via the emergentintegrations Anthropic path with the user-provided Anthropic API key stored server-side.
- The summary is generated at most once per hour per patient to control cost; opening the card returns the latest cached summary between generations.
- Every AI response ends with a fixed safety line: "DawaiSathi is not medical advice; contact a clinician for medical decisions."
- Notifications and Care Circle push behaviors will be fully verifiable only on real device builds; preview will show the UI and the summary text.

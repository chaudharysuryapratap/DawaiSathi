# Settings and reminder audio

Implemented: minimal Settings, authenticated name/email-login-ID/password edits,
immediate preference writes, explicit switch states, device-local text size and
haptic preferences, and four original WAV previews. Settings retains only the
voice-note-reminders preference for voice notes attached through Add medicine,
Checkup, and Staggered eye drops. There is no Settings voice recorder or global
voice-sound override. Existing saved audio is not deleted.

## Notification delivery boundary

This checkout has no `expo-notifications` dependency, notification scheduling
service, WhatsApp sender, or Telegram bot-linking endpoint. Settings do not
claim to have implemented those delivery systems. Telegram setup deliberately
stops before linking. WhatsApp preserves the existing preference only.

Today’s bell opens Inbox with All and Missed filters. All includes live reminder
alerts, saved missed-dose history, and account-scoped reminder requests. Missed
contains missed doses only. Resend is available for current actionable missed or
late doses, not old historical doses. Requests persist with `pending` delivery
status and idempotency keys; no sender or queue worker is implemented yet. The UI
must not label these requests as delivered. A future sender must write delivery
records for automatic notifications so All can include actual sent reminders.

Before wiring custom sounds:

- Build-time Expo custom sound paths are bundled with the native app through
  the expo-notifications config plugin. A new development/production build is
  required; Expo Go cannot validate app-specific native custom sounds.
- iOS sound files must be **less than 30 seconds**, in supported system sound
  formats. A runtime voice recording would need conversion (e.g. PCM WAV/CAF)
  and placement in `Library/Sounds`, with native integration and device testing.
  The current AAC/MP4 recording must not be passed blindly as a notification sound.
- Android 8+ sounds belong to notification channels. Their auditory behavior
  cannot be changed after creation: use a new/versioned channel ID when the
  selected sound changes, then route new notifications to that channel. Deleting
  and recreating the same ID is not a reliable way to reset sound behavior.
- User notification permissions, channel settings, silent mode, and Do Not
  Disturb remain authoritative. Custom sound playback is never guaranteed.
- Background/closed app playback of attached voice notes needs the above native
  notification integration, not background JS. The Settings switch persists the
  preference; it does not itself implement notification delivery.

Sources checked October 9, 2026:

- https://docs.expo.dev/versions/v56.0.0/sdk/notifications/
- https://docs.expo.dev/push-notifications/what-you-need-to-know/
- https://developer.apple.com/documentation/usernotifications/unnotificationsound
- https://developer.android.com/develop/ui/compose/notifications/channels

## Typography

The local Babel import plugin routes app-owned React Native Text/TextInput
imports through shared scalable primitives. App typography scales by 1, 1.15,
or 1.3; OS font scaling remains enabled. Existing maxFontSizeMultiplier limits
remain respected. Third-party icon fonts and packages are not rewritten.
Changes to Babel configuration require a full Metro restart; one was performed.

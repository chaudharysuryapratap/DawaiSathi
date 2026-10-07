# Voice-note storage contract

Scope: optional recording/upload and manual preview only. No notification scheduling, background audio, WhatsApp, Telegram, or automatic reminder playback is implemented here.

The medicine, checkup, and eye-drop protocol create/update/read APIs include `voice_note_url`. Existing records without this field return an empty string. Omit the field in PATCH to retain it; send `""` to remove the attachment. Explicit null is not accepted.

Authenticated `POST /api/voice-notes` accepts:

```json
{"content_type":"audio/mp4","audio_base64":"BASE64_AUDIO_BYTES"}
```

It returns `{"voice_note_url":"/media/voice-notes/UUID.m4a"}`. Pass that path when saving the item. Uploads are limited to 5 MiB and checked against M4A/MP4, MP3, WAV, WebM, or Ogg file signatures. This is signature checking, not a full media-decoding or duration validation service. The UI caps recordings at 30 seconds; uploaded audio has a byte limit, not a duration limit.

Audio bytes live under `backend/data/voice-notes` (override with `DAWAISATHI_VOICE_MEDIA_DIR`). MongoDB's `voice_notes` collection stores the owner, URL, content type, byte count, and creation time. Back up both MongoDB metadata and the media directory; transferring only the database does not transfer audio files.

`GET /media/voice-notes/{filename}` requires bearer authentication. The uploader can preview unattached uploads. Other users need family access to a medicine, checkup, or protocol that references the audio. Attachment validation prevents linking a note the caller cannot access. Responses are private and non-cacheable.

Remove clears the item's reference on Save; it does not immediately delete the file or metadata, since another item may still reference it. Failed/abandoned forms can leave unattached uploads. A retention/garbage-collection policy is deferred; do not treat this implementation as production retention management.

All three forms use a shared checkbox and side-by-side Record/Upload controls. The audio bubble is a stylized playback-progress visual, not an extracted amplitude waveform. Recording requests microphone permission only after tapping Record. Playback/recording is foreground-only and stops when the app leaves the foreground.

New native builds must include the expo-audio permission plugin. Physical Android/iPhone microphone and playback behavior still requires device verification. Later integration must map this field and media access to the original reminder services; a database connection alone will not activate those services.

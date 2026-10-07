# Family invitations and permanent codes

The permanent code is a randomly generated 64-bit value displayed as four groups of four hexadecimal characters. It is deliberately longer than a six-digit code because it grants access to private health records without owner approval.

MongoDB stores it once as `family_groups.join_code`, protected by a unique sparse index. Existing families are backfilled on listing; new families receive a code when created. Loading the invitation sheet, renaming the family, restarting the backend, and repeated invitations do not rotate it. Deleting the family makes its old code unusable. There is no code-rotation endpoint.

- `GET /api/family-groups/{id}/join-code`: authenticated owner only. Returns `{family_group_id, code}`.
- `POST /api/family-code/accept`: authenticated user; body `{code}`. Adds the user directly to `user_ids`, without an approval queue. Repeated joins are idempotent. Invalid/deleted codes return 404. There are 15 code attempts per account per 15-minute window, using MongoDB counters and TTL cleanup.
- Registration accepts this code in the existing `invitation_token` field. New accounts can join without an email-specific token. Existing bootstrap-owner and email-invitation behavior is retained. Google registration uses the same backend account-registration path.

Joining grants the existing family-member access scope; it does not make someone the family owner. Care profiles remain distinct from signed-in accounts. The member sheet exposes account invitations only; its separate care-profile creation option has been removed from the UI.

The QR encodes a `/join-family?code=...` URL. Signed-out visitors see account creation with the code prefilled, and existing users can switch to sign-in. Signed-in visitors confirm joining. In native development it uses the Expo deep link. The web preview uses the LAN hostname from `EXPO_PUBLIC_BACKEND_URL` when viewed on localhost. Set `EXPO_PUBLIC_APP_URL` for a real HTTPS production join URL. Expo Go/development links still require the development server to be reachable; a production build needs its normal app/universal-link setup.

“Send Email Invite” creates the existing seven-day email-specific invitation and opens a mailto draft. The user sends it in their mail app. This does not configure SMTP or claim delivery. A copyable token remains available if no mail app opens.

Security tradeoff requested by the user: anyone who obtains the permanent code can join. Codes/QRs should not be posted publicly or logged by analytics. Removing an account alone cannot stop it rejoining with the same leaked code. A genuinely compromised permanent code requires replacing/deleting the family under this no-rotation design.

Verification commands:

## Family deletion and recovery

Owners can delete a family; other members can only leave it. Deletion immediately blocks family access and both code/email-invitation joins. Login accounts and other families are unchanged. The owner can restore the family from **Deleted families** for 30 days, restoring its records, memberships, and original permanent code. Do not restore a family whose code was compromised.

This is soft deletion, not physical erasure: records remain stored after the recovery window expires, but the app no longer offers restoration. A permanent-purge policy/job is not implemented here and must be agreed before production integration.

Removing a non-primary care profile only unlinks it from the selected family. Its records remain in that family as shared records; profiles in other families and login accounts are not deleted. Primary profiles are protected.

Run `tests/test_family_deletion.py` alongside the tests below to verify access restrictions, recovery, and family-scoped profile removal.

```powershell
# From backend: isolated, disposable MongoDB test database; no production account changes.
.\.venv\Scripts\python.exe -m pytest -n 0 tests/test_family_codes.py tests/test_family_auth_isolated.py tests/test_voice_notes.py tests/test_medicine_images.py -q

# From frontend:
node --test scripts/family-ui.test.cjs scripts/voice-note.test.cjs scripts/medicine-photo.test.cjs scripts/medicine-time-picker.test.cjs
node node_modules/typescript/bin/tsc --noEmit
```

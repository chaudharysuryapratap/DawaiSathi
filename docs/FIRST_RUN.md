# First-run family setup

The source now allows ordinary email/password and Google registration without
an invitation or setup-code field. A public signup does not claim legacy family
records and is not made the legacy installation owner. Explicit backend bootstrap
credentials remain supported for administrators migrating an existing database.

After sign-in, users with no accessible family see a 94%-height, rounded welcome sheet
view. Membership is checked on the server, so closing the app before creating or
joining a family resumes setup on the next launch. Existing family members skip it.
The optional invite action reuses the existing join-family sheet and QR scanner.
Creation adds the account as the first member of its own private family.

The success view offers Family members or Today. Its confirmation is held locally
until an action is chosen; relaunching after successful family creation opens the
app normally. Close, backdrop, Android back and dragging the handle dismiss the sheet.
If no family exists, it reopens after two foreground minutes; membership is checked
again on the server first. Timers stop while the sheet is open or the app is in the
background and after membership is established. Keyboard visibility fades
the illustration, and font scale above 1.3 hides it. Reduce Motion replaces movement
with a short fade. All feedback uses the central haptics preference.

## Artwork

`frontend/assets/images/onboarding-family.png` is a static generated illustration,
not a screenshot of the interface. Built-in image generation prompt: smiling Indian
father, mother, boy and girl, warm flat illustration, pastel teal/peach clothing,
mint leaves and pale teal waves, wide transparent composition, no text or interface.
The output is an approximation of the supplied illustration, not pixel-identical.
`onboarding-leaves.svg` is static leaf artwork. The ring, check, orbit, dots, dashes
and stars are separate interface layers.

## Verification and release boundary

Isolated backend tests cover independent accounts, private first families, no
legacy-family inheritance, optional invitations and Google linking. Existing auth
storage/error tests, TypeScript checking and the web export pass. Native screen-reader, keyboard,
back-gesture and animation timing checks still require device testing.

This change has not been deployed to Google Cloud. The currently deployed staging
release remains invitation-only until a new API and web release are deployed together.
Public staging signup should also receive abuse/rate-limit protection and an
account-verification policy before wider distribution.

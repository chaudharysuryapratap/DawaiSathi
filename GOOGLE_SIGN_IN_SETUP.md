# Google sign-in setup

The existing welcome and email screens are implemented in the local application.
Google authentication is wired into the existing DawaiSathi account/session flow.
It cannot authenticate real users until the OAuth project is configured.

## Google Cloud

1. Create/select your project at https://console.cloud.google.com/ and configure Google Auth Platform branding, audience, and consent. Add test users while the consent screen is in Testing.
2. Create an OAuth client of type **Web application**. Add `http://localhost:8081` and `http://127.0.0.1:8081` as authorized JavaScript origins for local browser testing. Deployed sites need their actual HTTPS origin. Google web sign-in does not support arbitrary LAN HTTP origins.
3. Copy that Web client ID into `frontend/.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and into `backend/.env` as `GOOGLE_WEB_CLIENT_ID`. Both values must match. No client secret is needed for this ID-token flow.
4. For Android, create an **Android** OAuth client in the same Google project. Package: `com.emergent.smoothui.ciqrep`. Register the SHA-1 certificate fingerprint of the build you will actually install. Debug, EAS, release, and Play signing certificates may differ. The Android client ID is registered in Google Cloud; the application requests ID tokens using the Web client ID.
5. For iOS, create an iOS client for bundle ID `com.emergent.smoothui.ciqrep` and set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. The Expo config adds its reversed URL scheme.

## Install and run

The dependency additions are recorded in the existing package manifests/lockfile.
On another checkout run `yarn install` in `frontend` and install the backend requirements into its virtual environment.
Restart backend and Metro after editing environment variables.
Public configuration templates are provided in `frontend/google.env.example` and `backend/google.env.example`; copy their entries into the corresponding local `.env` files, not secrets into version control.

### Browser

Run `yarn web` in `frontend`, open `http://localhost:8081/auth`, and select Continue with Google.
The Google page renders Google's own sign-in button once the Web client ID is supplied.
The backend must be running on port 8000. The web client uses the existing localhost API setting.

### Android

Expo Go does not include the native Google sign-in module. Use an Android build of this project.
With Android Studio/JDK/SDK configured, run `npx expo run:android` from `frontend` to generate/build/install the Android app. This generates native project files; do not run it merely to test the existing Expo Go email flow.
For an EAS build, configure the project's EAS build/credentials separately and register that build's signing SHA-1 before testing. No cloud build or credential changes were performed here.

## Account behavior and verification

- Existing email/password users enter their current DawaiSathi password once to link Google. A matching email alone never links an account.
- First owner accounts still need the configured one-time setup token. Subsequent new users need an invitation bound to their verified Google email.
- Linked users sign in by Google's stable subject ID; verified Google claims are checked by the backend with `google-auth` (signature, expiration, issuer, audience), then the app stores its normal DawaiSathi session through the existing secure-storage code.
- Test account selection/cancellation, first-time linking, wrong password, valid/expired/wrong-email invitations, returning Google users, and app restart. Run backend isolated auth tests and frontend storage tests before release.
- Real Google account selection and Android native sign-in remain unverified until client IDs and an installed build are available.

References: https://docs.expo.dev/guides/google-authentication/ ; https://react-native-google-signin.github.io/docs/setting-up/expo ; https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

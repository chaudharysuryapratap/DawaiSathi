# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Local browser development (Windows)

From the repository root, run `Start-DawaiSathi-Web.bat`. It starts the existing
`dawaisathi-mongo` container only when stopped, starts the backend only when port
8000 is free, and starts Expo Web only when port 8081 is free. It opens
`http://localhost:8081`. Backend and Expo logs are written to
`%LOCALAPPDATA%\DawaiSathi\logs`. Run `Stop-DawaiSathi-Web.bat` to stop only
processes recorded as started by this launcher; MongoDB and pre-existing
development servers are never stopped.

The browser uses `http://127.0.0.1:8000` for the API by default. Set
`EXPO_PUBLIC_BACKEND_URL_WEB` if a different browser API URL is needed. Android
continues to use `EXPO_PUBLIC_BACKEND_URL` (for example, the computer's
LAN-reachable address); do not set that device URL to `127.0.0.1`. FastAPI
allows only the explicit local Expo Web origins by default; set `CORS_ORIGINS`
to a comma-separated list if the browser origin or port changes.

Web storage persists in the browser using AsyncStorage's web implementation.
Prescription camera capture requires a device camera and is not available in a
desktop browser; browser-based prescription upload also remains a placeholder.

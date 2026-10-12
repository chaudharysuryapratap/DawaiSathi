const base = require("./app.json");

module.exports = () => {
  const staging = process.env.APP_VARIANT === "staging";
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (process.env.EAS_BUILD_PROFILE === "staging") {
    const url = backendUrl ? new URL(backendUrl) : null;
    if (!url || url.protocol !== "https:" || ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
      throw new Error("Staging APK requires EXPO_PUBLIC_BACKEND_URL to be the public HTTPS origin without /api.");
    }
  }
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const plugins = [...base.expo.plugins];
  plugins.push("expo-sharing");
  // iOS needs its reversed client-ID URL scheme; Android uses its package + SHA-1 registration.
  if (iosClientId) {
    plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme: iosClientId.split(".").reverse().join(".") }]);
  }
  return {
    ...base.expo,
    ...(staging ? {
      name: "DawaiSathi Staging",
      slug: "dawaisathi-staging",
      scheme: "dawaisathi-staging",
      android: { ...base.expo.android, package: `${base.expo.android.package}.staging` },
      ios: { ...base.expo.ios, bundleIdentifier: `${base.expo.ios.bundleIdentifier}.staging` },
    } : {}),
    extra: { ...base.expo.extra, ...(backendUrl ? { backendUrl } : {}) },
    plugins,
  };
};

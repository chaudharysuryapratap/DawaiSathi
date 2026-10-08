const base = require("./app.json");

module.exports = () => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const plugins = [...base.expo.plugins];
  plugins.push("expo-sharing");
  // iOS needs its reversed client-ID URL scheme; Android uses its package + SHA-1 registration.
  if (iosClientId) {
    plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme: iosClientId.split(".").reverse().join(".") }]);
  }
  return { ...base.expo, plugins };
};

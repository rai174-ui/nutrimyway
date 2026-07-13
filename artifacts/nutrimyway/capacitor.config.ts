import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "in.nutrimyway.app",
  appName: "NutriMyWay",
  webDir: "dist/public",
  server: {
    // In production, the app loads from the bundled files.
    // For live reload during dev (optional):
    // url: "http://localhost:5173",
    // cleartext: true,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      releaseType: "AAB",
    },
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;

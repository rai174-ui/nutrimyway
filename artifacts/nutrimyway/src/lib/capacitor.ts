/**
 * Capacitor native platform utilities.
 * Safe to import from web code — no Capacitor APIs are called on non-native builds.
 */

import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";

export function native(): boolean {
  return Capacitor.isNativePlatform();
}

export function platform(): string {
  return Capacitor.getPlatform();
}

/**
 * Take or pick a photo using the native camera on Android/iOS.
 * Returns a base64-encoded JPEG string (data after the comma).
 */
export async function snapPhoto(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const photo = await Camera.getPhoto({
      quality: 82,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt, // Let user choose Camera or Gallery
      width: 900,
    });
    return photo.base64String ?? null;
  } catch {
    return null;
  }
}

/**
 * Initialize push notifications and register device token with backend.
 */
export async function initPushNotifications(memberId: number, apiBase: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // Create notification channels first (Android requires this before register)
  if (platform() === "android") {
    try {
      await PushNotifications.createChannel({
        id: "default",
        name: "General Notifications",
        description: "General notifications for NutriMyWay",
        importance: 5, // High importance (shows heads-up notification)
        visibility: 1, // Public visibility
        vibration: true,
      });
      await LocalNotifications.createChannel({
        id: "default",
        name: "General Notifications",
        description: "General notifications for NutriMyWay",
        importance: 5,
        visibility: 1,
        vibration: true,
      });
    } catch {
      // safely ignore if channel already exists
    }
  }

  // Request permission
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") {
    console.warn("[Push] Permission not granted");
    return;
  }
  await LocalNotifications.requestPermissions();

  // Remove any previously registered listeners to avoid stacking duplicates
  await PushNotifications.removeAllListeners();

  // Listen for token registration
  PushNotifications.addListener("registration", async (token) => {
    console.log("[Push] FCM token received:", token.value.substring(0, 20) + "...");
    try {
      const authRaw = localStorage.getItem("nmw_auth");
      const authToken = authRaw ? (JSON.parse(authRaw) as { token?: string }).token : null;
      const res = await fetch(`${apiBase}/members/${memberId}/push-token`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ token: token.value, platform: "android" }),
      });
      console.log("[Push] Token saved to server, status:", res.status);
    } catch (err) {
      console.error("[Push] Failed to save token:", err);
    }
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[Push] Registration error:", err);
  });

  // Listen for incoming notifications when app is in foreground
  PushNotifications.addListener("pushNotificationReceived", async (notification) => {
    // Display as a local notification (system alert) so the user sees it immediately
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() / 1000), // safe 32-bit int
          title: notification.title || "NutriMyWay",
          body: notification.body || "",
          schedule: { at: new Date(Date.now() + 100) },
          channelId: "default",
          smallIcon: "ic_launcher_round",
        },
      ],
    });
  });

  // Register with FCM — this triggers the "registration" event above
  console.log("[Push] Registering with FCM for member", memberId);
  await PushNotifications.register();
}

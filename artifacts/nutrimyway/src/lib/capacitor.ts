/**
 * Capacitor native platform utilities.
 * Safe to import from web code — no Capacitor APIs are called on non-native builds.
 */

import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { PushNotifications } from "@capacitor/push-notifications";

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

  // Request permission
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;

  // Start listening for token
  PushNotifications.addListener("registration", async (token) => {
    try {
      await fetch(`${apiBase}/members/${memberId}/push-token`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.value, platform: "android" }),
      });
    } catch {
      // silently fail
    }
  });

  PushNotifications.addListener("registrationError", () => {
    // silently fail
  });

  // Create high-importance channel for Android so notifications show up even in foreground
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
    } catch {
      // safely ignore if channel already exists or creation fails
    }
  }

  // Register with FCM
  await PushNotifications.register();
}

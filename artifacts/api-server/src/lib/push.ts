import { initializeApp, cert, getApps, applicationDefault, type ServiceAccount } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import path from "path";
import fs from "fs";
import { logger } from "./logger";

let firebaseInitialized = false;
let firebaseInitError = "";

function parseServiceAccount(raw: string): ServiceAccount {
  // raw could be plain JSON or base64-encoded JSON
  let jsonStr = raw.trim();

  // Detect base64: JSON always starts with '{'
  if (!jsonStr.startsWith("{")) {
    try {
      jsonStr = Buffer.from(jsonStr, "base64").toString("utf8");
    } catch {
      // not base64, use as-is
    }
  }

  const parsed = JSON.parse(jsonStr) as ServiceAccount & { private_key?: string };
  // Fix common issue: env vars double-escape \n in private key
  if (parsed.private_key && typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

function tryInitFirebase(): void {
  // Only initialize once
  if (getApps().length > 0) {
    firebaseInitialized = true;
    return;
  }

  const serviceAccountPath = path.join(process.cwd(), "service-account.json");

  if (fs.existsSync(serviceAccountPath)) {
    try {
      const raw = fs.readFileSync(serviceAccountPath, "utf8");
      const serviceAccount = parseServiceAccount(raw);
      initializeApp({ credential: cert(serviceAccount) });
      firebaseInitialized = true;
      logger.info("Firebase Admin SDK initialized from service-account.json");
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      firebaseInitError = `service-account.json: ${msg}`;
      logger.error({ err }, "Failed to initialize Firebase from service-account.json");
    }
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({ credential: cert(serviceAccount) });
      firebaseInitialized = true;
      logger.info("Firebase Admin SDK initialized from FIREBASE_SERVICE_ACCOUNT env var");
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      firebaseInitError = `FIREBASE_SERVICE_ACCOUNT env: ${msg}`;
      logger.error({ err }, "Failed to initialize Firebase from FIREBASE_SERVICE_ACCOUNT");
    }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      initializeApp({ credential: applicationDefault() });
      firebaseInitialized = true;
      logger.info("Firebase Admin SDK initialized from GOOGLE_APPLICATION_CREDENTIALS");
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      firebaseInitError = `GOOGLE_APPLICATION_CREDENTIALS: ${msg}`;
      logger.error({ err }, "Failed to initialize Firebase from GOOGLE_APPLICATION_CREDENTIALS");
    }
  }

  if (!firebaseInitialized) {
    const noCredsMsg = "No Firebase credentials found or all attempts failed";
    if (!firebaseInitError) firebaseInitError = noCredsMsg;
    logger.warn(firebaseInitError);
  }
}

tryInitFirebase();

export function isFirebaseInitialized(): boolean {
  return firebaseInitialized;
}

export function getFirebaseInitError(): string {
  return firebaseInitError;
}

export async function sendPushNotification(tokens: string[], title: string, body: string, imageUrl?: string): Promise<void> {
  if (tokens.length === 0) return;
  if (!firebaseInitialized) {
    logger.warn("Firebase not initialized; skipping push notification");
    return;
  }

  const messaging = getMessaging();
  const MAX_BATCH_SIZE = 500;

  for (let i = 0; i < tokens.length; i += MAX_BATCH_SIZE) {
    const batch = tokens.slice(i, i + MAX_BATCH_SIZE);
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
        android: {
          priority: "high",
          notification: {
            channelId: "default",
            sound: "default",
          },
        },
      });

      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(batch[idx]);
            logger.error({ error: resp.error, token: batch[idx] }, "Failed to send push to token");
          }
        });
        logger.warn({ failedCount: response.failureCount, failedTokens }, "Some push notifications failed");
      }

      logger.info({ successCount: response.successCount }, "Push notification batch sent");
    } catch (err) {
      logger.error({ err }, "Error sending push notification batch");
    }
  }
}

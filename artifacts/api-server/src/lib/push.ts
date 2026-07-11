import * as admin from "firebase-admin";
import path from "path";
import fs from "fs";
import { logger } from "./logger";

let firebaseInitialized = false;
let firebaseInitError = "";

function parseServiceAccount(raw: string): admin.ServiceAccount {
  // raw could be JSON string or base64-encoded JSON
  let jsonStr = raw.trim();
  
  // Detect base64: no '{' at start means it's likely base64
  if (!jsonStr.startsWith("{")) {
    try {
      jsonStr = Buffer.from(jsonStr, "base64").toString("utf8");
    } catch {
      // not base64, use as-is
    }
  }
  
  const parsed = JSON.parse(jsonStr) as admin.ServiceAccount & { private_key?: string };
  // Fix common issue: env vars double-escape \n in private key
  if (parsed.private_key && typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

function tryInitFirebase(): void {
  const serviceAccountPath = path.join(process.cwd(), "service-account.json");

  if (fs.existsSync(serviceAccountPath)) {
    try {
      const raw = fs.readFileSync(serviceAccountPath, "utf8");
      const serviceAccount = parseServiceAccount(raw);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
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
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
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
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
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

export async function sendPushNotification(tokens: string[], title: string, body: string): Promise<void> {
  if (tokens.length === 0) return;
  if (!admin.apps.length) {
    logger.warn("Firebase Admin SDK not initialized; skipping push notification");
    return;
  }

  // FCM multicast allows max 500 tokens per request
  const MAX_BATCH_SIZE = 500;
  
  for (let i = 0; i < tokens.length; i += MAX_BATCH_SIZE) {
    const batch = tokens.slice(i, i + MAX_BATCH_SIZE);
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        notification: {
          title,
          body,
        },
        android: {
          notification: {
            channelId: "default",
          }
        }
      });

      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(batch[idx]);
            logger.error({ error: resp.error, token: batch[idx] }, "Failed to send push notification to token");
          }
        });
        logger.warn({ failedCount: response.failureCount, failedTokens }, "Some push notifications failed to send");
      }
      
      logger.info({ successCount: response.successCount }, "Push notification batch sent successfully");
    } catch (err) {
      logger.error({ err }, "Error sending push notification batch");
    }
  }
}

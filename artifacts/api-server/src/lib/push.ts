import * as admin from "firebase-admin";
import path from "path";
import fs from "fs";
import { logger } from "./logger";

let firebaseInitialized = false;

function parseServiceAccount(raw: string): admin.ServiceAccount {
  const parsed = JSON.parse(raw) as admin.ServiceAccount & { private_key?: string };
  // Fix common issue: Railway/Heroku env vars double-escape \n in private key
  if (parsed.private_key && typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

const serviceAccountPath = path.join(process.cwd(), "service-account.json");

if (fs.existsSync(serviceAccountPath)) {
  try {
    const raw = fs.readFileSync(serviceAccountPath, "utf8");
    const serviceAccount = parseServiceAccount(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseInitialized = true;
    logger.info("Firebase Admin SDK initialized from service-account.json");
  } catch (err) {
    logger.error({ err }, "Failed to initialize Firebase Admin SDK from service-account.json");
  }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseInitialized = true;
    logger.info("Firebase Admin SDK initialized from FIREBASE_SERVICE_ACCOUNT env var");
  } catch (err) {
    logger.error({ err }, "Failed to initialize Firebase Admin SDK from FIREBASE_SERVICE_ACCOUNT");
  }
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    firebaseInitialized = true;
    logger.info("Firebase Admin SDK initialized from GOOGLE_APPLICATION_CREDENTIALS");
  } catch (err) {
    logger.error({ err }, "Failed to initialize Firebase Admin SDK from GOOGLE_APPLICATION_CREDENTIALS");
  }
} else {
  logger.warn("No Firebase credentials found. Push notifications will be disabled.");
}

export function isFirebaseInitialized(): boolean {
  return firebaseInitialized;
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

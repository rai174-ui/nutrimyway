import * as admin from "firebase-admin";
import path from "path";
import fs from "fs";
import { logger } from "./logger";

const serviceAccountPath = path.join(process.cwd(), "service-account.json");

if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.info("Firebase Admin SDK initialized successfully");
  } catch (err) {
    logger.error({ err }, "Failed to initialize Firebase Admin SDK from service-account.json");
  }
} else {
  logger.warn("service-account.json not found in api-server root. Push notifications will be disabled.");
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

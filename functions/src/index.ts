// Cloud Functions: uploadLeagueImage (league cover via Firebase Storage only), parseScoreFromImage (Vision API for scoreboard photos only; not league images).
// ref: Firebase Storage Admin - https://firebase.google.com/docs/storage/admin/start
// ref: Cloud Vision - https://cloud.google.com/vision/docs
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as vision from "@google-cloud/vision";
import { randomUUID } from "crypto";

admin.initializeApp({
  storageBucket: "thegameroomenvironment.firebasestorage.app",
});
const visionClient = new vision.ImageAnnotatorClient();

const LEAGUE_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB

// I upload a league cover image (base64) to Storage and return a permanent download URL. avoids client blob/URI issues on RN.
export const uploadLeagueImage = functions.region("europe-west1").https.onCall(
  async (data: { leagueId?: string; imageBase64?: string }, context: functions.https.CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError("unauthenticated", "You must be signed in to upload a league image.");
    }
    const leagueId = data?.leagueId;
    if (!leagueId || typeof leagueId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(leagueId)) {
      throw new functions.https.HttpsError("invalid-argument", "Missing or invalid leagueId.");
    }
    const base64 = data?.imageBase64;
    if (!base64 || typeof base64 !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "Missing or invalid imageBase64.");
    }
    const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
    const imageBuffer = Buffer.from(base64Data, "base64");
    if (imageBuffer.length > LEAGUE_IMAGE_MAX_BYTES) {
      throw new functions.https.HttpsError("invalid-argument", "Image is too large (max 5MB).");
    }
    const path = `leagueImages/${leagueId}.jpg`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(path);
    try {
      await file.save(imageBuffer, {
        metadata: { contentType: "image/jpeg" },
      });
      // permanent URL via download token (signed URLs are max 7 days)
      const token = randomUUID();
      await file.setMetadata({
        metadata: { firebaseStorageDownloadTokens: token },
      });
      const bucketName = bucket.name;
      const encodedPath = encodeURIComponent(path);
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
      return { downloadUrl };
    } catch (err: unknown) {
      functions.logger.error("uploadLeagueImage error", err);
      throw new functions.https.HttpsError("internal", (err as Error)?.message ?? "Failed to upload league image.");
    }
  }
);

export const parseScoreFromImage = functions.region("europe-west1").https.onCall(
  async (data: { imageBase64?: string; idToken?: string }, context: functions.https.CallableContext) => {
    const hasContextAuth = !!context.auth?.uid;
    const hasIdToken = !!(data?.idToken && typeof data.idToken === "string");
    functions.logger.info("parseScoreFromImage auth", { hasContextAuth, hasIdToken });

    let uid: string | undefined = context.auth?.uid;
    if (!uid && data?.idToken && typeof data.idToken === "string") {
      try {
        const decoded = await admin.auth().verifyIdToken(data.idToken);
        uid = decoded.uid;
      } catch (e) {
        functions.logger.warn("parseScoreFromImage idToken verify failed", e);
        throw new functions.https.HttpsError("unauthenticated", "Invalid or expired sign-in. Try signing out and back in.");
      }
    }
    if (!uid) {
      throw new functions.https.HttpsError("unauthenticated", "You must be signed in to use this feature.");
    }
    const base64 = data?.imageBase64;
    if (!base64 || typeof base64 !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "Missing or invalid imageBase64.");
    }
    const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
    const imageBuffer = Buffer.from(base64Data, "base64");
    if (imageBuffer.length > 10 * 1024 * 1024) {
      throw new functions.https.HttpsError("invalid-argument", "Image is too large (max 10MB).");
    }
    try {
      const [result] = await visionClient.textDetection({ image: { content: imageBuffer } });
      const fullText = result.fullTextAnnotation?.text?.trim() ?? "";
      if (!fullText) {
        return { success: false, error: "No text found in the image. Try a clearer photo of the score." };
      }
      const parsed = parseTwoScoresFromText(fullText);
      if (!parsed) {
        return { success: false, error: "Could not find two clear scores in the image. Check the photo and try again." };
      }
      return { success: true, player1Score: parsed.player1Score, player2Score: parsed.player2Score };
    } catch (err: unknown) {
      functions.logger.error("Vision API error", err);
      throw new functions.https.HttpsError("internal", (err as Error)?.message ?? "Failed to read score from image.");
    }
  }
);

function parseTwoScoresFromText(text: string): { player1Score: number; player2Score: number } | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  const separators = [/(\d+)\s*[-–—]\s*(\d+)/, /(\d+)\s*:\s*(\d+)/, /(\d+)\s*\/\s*(\d+)/, /(\d+)\s+(\d+)/];
  for (const sep of separators) {
    const match = normalized.match(sep);
    if (match) {
      const a = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      if (Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0) {
        return { player1Score: a, player2Score: b };
      }
    }
  }
  const numbers = [...normalized.matchAll(/\d+/g)].map((m) => parseInt(m[0], 10)).filter((n) => n >= 0);
  if (numbers.length >= 2) return { player1Score: numbers[0], player2Score: numbers[1] };
  return null;
}

// HTTP endpoint: same logic as callable, but auth via Authorization: Bearer <idToken>. Use this if the callable fails with unauthenticated on Expo/RN.
const PARSE_SCORE_REGION = "europe-west1";

function setCors(res: { set: (name: string, value: string) => void }) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "86400");
}

export const parseScoreFromImageHttp = functions
  .region(PARSE_SCORE_REGION)
  .https.onRequest(async (req, res) => {
    if (req.method === "OPTIONS") {
      setCors(res);
      res.status(204).send("");
      return;
    }
    setCors(res);
    if (req.method !== "POST") {
      res.status(405).json({ success: false, error: "Method not allowed." });
      return;
    }
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      res.status(401).json({ success: false, error: "Missing or invalid Authorization header." });
      return;
    }
    let uid: string;
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      res.status(401).json({ success: false, error: "Invalid or expired sign-in. Try signing out and back in." });
      return;
    }
    const body = req.body as { imageBase64?: string };
    const base64 = body?.imageBase64;
    if (!base64 || typeof base64 !== "string") {
      res.status(400).json({ success: false, error: "Missing or invalid imageBase64." });
      return;
    }
    const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
    const imageBuffer = Buffer.from(base64Data, "base64");
    if (imageBuffer.length > 10 * 1024 * 1024) {
      res.status(400).json({ success: false, error: "Image is too large (max 10MB)." });
      return;
    }
    try {
      const [result] = await visionClient.textDetection({ image: { content: imageBuffer } });
      const fullText = result.fullTextAnnotation?.text?.trim() ?? "";
      if (!fullText) {
        res.status(200).json({ success: false, error: "No text found in the image. Try a clearer photo of the score." });
        return;
      }
      const parsed = parseTwoScoresFromText(fullText);
      if (!parsed) {
        res.status(200).json({ success: false, error: "Could not find two clear scores in the image. Check the photo and try again." });
        return;
      }
      res.status(200).json({ success: true, player1Score: parsed.player1Score, player2Score: parsed.player2Score });
    } catch (err: unknown) {
      functions.logger.error("Vision API error (HTTP)", err);
      res.status(500).json({ success: false, error: (err as Error)?.message ?? "Failed to read score from image." });
    }
  });

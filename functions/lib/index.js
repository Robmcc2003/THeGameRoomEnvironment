"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseScoreFromImageHttp = exports.parseScoreFromImage = exports.uploadLeagueImage = void 0;
/**
 * Cloud Function: parseScoreFromImage
 * Uses Google Cloud Vision API to read text from a scoreboard/screenshot image
 * and returns suggested player1 and player2 scores. Called from the app when
 * the user chooses "Submit photo of score".
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");
const crypto_1 = require("crypto");
admin.initializeApp({
    storageBucket: "thegameroomenvironment.firebasestorage.app",
});
const visionClient = new vision.ImageAnnotatorClient();
const LEAGUE_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB
/**
 * Callable: uploadLeagueImage
 * Uploads a league cover image (base64) to Storage and returns a long-lived download URL.
 * Avoids client-side Blob/URI issues on React Native.
 */
exports.uploadLeagueImage = functions.region("europe-west1").https.onCall(async (data, context) => {
    var _a, _b;
    const uid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "You must be signed in to upload a league image.");
    }
    const leagueId = data === null || data === void 0 ? void 0 : data.leagueId;
    if (!leagueId || typeof leagueId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(leagueId)) {
        throw new functions.https.HttpsError("invalid-argument", "Missing or invalid leagueId.");
    }
    const base64 = data === null || data === void 0 ? void 0 : data.imageBase64;
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
        // Permanent URL: use download token (signed URLs are limited to 7 days max)
        const token = (0, crypto_1.randomUUID)();
        await file.setMetadata({
            metadata: { firebaseStorageDownloadTokens: token },
        });
        const bucketName = bucket.name;
        const encodedPath = encodeURIComponent(path);
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
        return { downloadUrl };
    }
    catch (err) {
        functions.logger.error("uploadLeagueImage error", err);
        throw new functions.https.HttpsError("internal", (_b = err === null || err === void 0 ? void 0 : err.message) !== null && _b !== void 0 ? _b : "Failed to upload league image.");
    }
});
exports.parseScoreFromImage = functions.region("europe-west1").https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f;
    const hasContextAuth = !!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid);
    const hasIdToken = !!((data === null || data === void 0 ? void 0 : data.idToken) && typeof data.idToken === "string");
    functions.logger.info("parseScoreFromImage auth", { hasContextAuth, hasIdToken });
    let uid = (_b = context.auth) === null || _b === void 0 ? void 0 : _b.uid;
    if (!uid && (data === null || data === void 0 ? void 0 : data.idToken) && typeof data.idToken === "string") {
        try {
            const decoded = await admin.auth().verifyIdToken(data.idToken);
            uid = decoded.uid;
        }
        catch (e) {
            functions.logger.warn("parseScoreFromImage idToken verify failed", e);
            throw new functions.https.HttpsError("unauthenticated", "Invalid or expired sign-in. Try signing out and back in.");
        }
    }
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "You must be signed in to use this feature.");
    }
    const base64 = data === null || data === void 0 ? void 0 : data.imageBase64;
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
        const fullText = (_e = (_d = (_c = result.fullTextAnnotation) === null || _c === void 0 ? void 0 : _c.text) === null || _d === void 0 ? void 0 : _d.trim()) !== null && _e !== void 0 ? _e : "";
        if (!fullText) {
            return { success: false, error: "No text found in the image. Try a clearer photo of the score." };
        }
        const parsed = parseTwoScoresFromText(fullText);
        if (!parsed) {
            return { success: false, error: "Could not find two clear scores in the image. Check the photo and try again." };
        }
        return { success: true, player1Score: parsed.player1Score, player2Score: parsed.player2Score };
    }
    catch (err) {
        functions.logger.error("Vision API error", err);
        throw new functions.https.HttpsError("internal", (_f = err === null || err === void 0 ? void 0 : err.message) !== null && _f !== void 0 ? _f : "Failed to read score from image.");
    }
});
function parseTwoScoresFromText(text) {
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
    if (numbers.length >= 2)
        return { player1Score: numbers[0], player2Score: numbers[1] };
    return null;
}
// HTTP endpoint: same logic as callable, but auth via Authorization: Bearer <idToken>. Use this if the callable fails with unauthenticated on Expo/RN.
const PARSE_SCORE_REGION = "europe-west1";
function setCors(res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Max-Age", "86400");
}
exports.parseScoreFromImageHttp = functions
    .region(PARSE_SCORE_REGION)
    .https.onRequest(async (req, res) => {
    var _a, _b, _c, _d;
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
    const token = (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith("Bearer ")) ? authHeader.slice(7) : null;
    if (!token) {
        res.status(401).json({ success: false, error: "Missing or invalid Authorization header." });
        return;
    }
    let uid;
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        uid = decoded.uid;
    }
    catch (_e) {
        res.status(401).json({ success: false, error: "Invalid or expired sign-in. Try signing out and back in." });
        return;
    }
    const body = req.body;
    const base64 = body === null || body === void 0 ? void 0 : body.imageBase64;
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
        const fullText = (_c = (_b = (_a = result.fullTextAnnotation) === null || _a === void 0 ? void 0 : _a.text) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : "";
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
    }
    catch (err) {
        functions.logger.error("Vision API error (HTTP)", err);
        res.status(500).json({ success: false, error: (_d = err === null || err === void 0 ? void 0 : err.message) !== null && _d !== void 0 ? _d : "Failed to read score from image." });
    }
});
//# sourceMappingURL=index.js.map
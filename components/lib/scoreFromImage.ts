// call Cloud Function (Vision API only; not used for league images) to read scores from scoreboard photo; HTTP endpoint with Bearer token for Expo/RN
// ref: Vision API - https://cloud.google.com/vision/docs
import { auth } from "../../FirebaseConfig";

const PARSE_SCORE_HTTP_URL = "https://europe-west1-thegameroomenvironment.cloudfunctions.net/parseScoreFromImageHttp";

export type ParseScoreResult =
  | { success: true; player1Score: number; player2Score: number }
  | { success: false; error: string };

export async function parseScoreFromImage(imageBase64: string): Promise<ParseScoreResult> {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, error: "You must be signed in to use this feature." };
  }
  const idToken = await user.getIdToken(true);
  const response = await fetch(PARSE_SCORE_HTTP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ imageBase64 }),
  });
  const data = (await response.json()) as { success?: boolean; player1Score?: number; player2Score?: number; error?: string };
  if (response.ok && data?.success && typeof data.player1Score === "number" && typeof data.player2Score === "number") {
    return { success: true, player1Score: data.player1Score, player2Score: data.player2Score };
  }
  return { success: false, error: data?.error ?? "Could not read scores from image." };
}

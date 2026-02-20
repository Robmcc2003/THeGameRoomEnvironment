# Cloud Functions – Score from photo (Iteration 5)

This folder has two functions: **uploadLeagueImage** (league cover → Firebase Storage) and **parseScoreFromImage** (scoreboard photo → Vision API). Only **parseScoreFromImage** uses Cloud Vision; league images use Storage only.

The **parseScoreFromImage** function uses Google Cloud Vision to read text from a scoreboard/screenshot image and returns two suggested scores for the user to confirm in the app.

## One-time setup

1. **Enable Cloud Vision API**  
   In [Google Cloud Console](https://console.cloud.google.com/apis/library/vision.googleapis.com) for project `thegameroomenvironment`, enable **Cloud Vision API**.

2. **Blaze plan**  
   Your Firebase project must be on the **Blaze (pay-as-you-go)** plan. Vision has a [free tier](https://cloud.google.com/vision/pricing) (e.g. 1,000 images/month).

3. **Install and deploy**
   ```bash
   cd functions
   npm install
   npm run build
   cd ..
   firebase deploy --only functions
   ```

The app calls the function in region **europe-west1**. If you deploy to another region, update the region in `FirebaseConfig.ts` and in `functions/src/index.ts`.

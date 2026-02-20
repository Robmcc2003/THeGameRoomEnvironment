# The Game Room Environment — References
## Project summary
A React Native mobile app for managing tournament leagues, brackets, and player statistics.

## Key Files
### `app/_layout.tsx`
App-wide navigation, authentication state, theme, fonts
### `app/index.tsx`
User authentication, sign up, and profile creation.
### `components/lib/tournaments.ts`
Tournament-related functions:
- `joinTournament()` - Join a tournament
- `getTournamentBracket()` - Retrieve and organise matches
- `generateBracketMatches()` - Create bracket matches
- `autoGenerateBracketIfNeeded()` - Auto-generate brackets
- `getTournamentStandings()` - Calculate statistics
- `updateMatchScore()` - Update match scores
- `verifyMatchScore()` - Verify scores (admin only!)
- `getUserProgress()` - Calculate user progress
- `getUserOverallStats()` - Overall user statistics
- `getUserTournamentHistory()` - Tournament history

### `components/lib/leagues.ts`
League creation, updates, deletion, and cover image upload (via Cloud Function to Firebase Storage, not Vision API).
### `components/lib/members.ts`
League member management, invites, and role assignments.

### `components/lib/scoreFromImage.ts`
Calls Cloud Function to parse scores from a scoreboard photo (Vision API only; league images use Storage). HTTP endpoint with Bearer token.

### `components/lib/avatars.ts`
Profile avatars (Bottts Neutral style via DiceBear):
- `AVATAR_OPTIONS` – 36 predefined options, gaming-themed
- `getAvatarImageUrl(avatarId)` – image URL for an avatar id
- `getProfileImageUrl(user)` – best profile image (photoURL or avatar)

### `components/ui/AvatarPicker.tsx`
Modal picker for choosing a profile avatar; used on the Profile tab

### `components/ui/AnimatedTabBar.tsx`
Custom bottom tab bar (Airbnb-style): sliding pill indicator, semi-transparent bar, ease-in-out cubic animation. Used via `tabBar` prop in the tabs layout

### `app/(tabs)/_layout.tsx`
Tabs layout: four tabs (Sign Out, Home, Profile, My Leagues), custom `tabBar` (above), and screen transition

### `components/ui/WalkthroughCarousel.tsx`
Compact horizontal carousel with dot indicators; used on the create-league section (My Leagues) to show short tips (name, format, options, invite), different game choices, etc.

## Database Structure
### Collections
#### `users`
- `userId` (document ID)
- `email`, `username`, `displayName`
- `avatarId` (optional; DiceBear Bots Neutral seed for profile avatar)
- `photoURL` (optional; custom profile photo URL)
- `role` ('user' or 'admin')
- `createdAt`, `updatedAt`

#### `leagues`
- `leagueId` (document ID)
- `name`, `ownerId`, `admins`
- `tournamentFormat` ('single_elimination', 'double_elimination', 'round_robin', 'normal_league')
- `maxParticipants`, `description`
- `startDate`, `endDate`
- `logoUrl` (optional; Firebase Storage URL for league cover image, set by admins)

#### `leagueMembers`
- `memberId` (document ID): `${leagueId}_${userId}`
- `leagueId`, `userId`
- `role` ('member' or 'admin')
- `status` ('active', 'invited', 'pending')
- `displayName`, `username`, `photoURL`, `avatarId` (copied from user when added)
- `joinedAt`

#### `tournamentMatches`
- `matchId` (document ID): `${leagueId}_r${round}_m${matchNumber}`
- `leagueId`, `round`, `matchNumber`
- `player1Id`, `player2Id`
- `status` ('pending', 'in_progress', 'completed')
- `result` (scores, winner, verification status)
- `createdAt`, `completedAt`

#### `leagueInvites`
- `inviteId` (document ID): `${leagueId}_${emailLower}`
- `leagueId`, `emailLower`
- `status` ('pending', 'accepted', 'declined')
- `createdAt`

### Authorisations
- **Users**: Read own profile, read leagues, join tournaments, submit scores
- **League Owners**: Full control of their leagues
- **League Admins**: Manage members, verify scores
- **System Admins**: Verify scores in any league

## Refs
### Firebase Config
- **Source**: YouTube Tutorial (2022)
- **URL**: https://youtu.be/a0KJ7l5sNGw?si=caznuBD8jCD2er9v
- **Location**: `FirebaseConfig.ts` (lines 1-37)
- **Description**: Firebase initialisation, authentication setup, and Firestore configuration

### Firebase Analytics
- **Source**: Firebase Analytics Documentation
- **URL**: https://firebase.google.com/docs/analytics/get-started
- **Location**: `FirebaseConfig.ts` (lines 2, 23-35)
- **Description**: Firebase Analytics initialisation and platform support checking

### Navigation and App Structure
- **Source**: Expo Router Documentation
- **URL**: https://docs.expo.dev/router/introduction/
- **Location**: `app/_layout.tsx` (lines 3, 11-109)
- **Description**: Navigation structure and routing setup

### React Nav Theme
- **Source**: React Navigation Documentation
- **URL**: https://reactnavigation.org/docs/themes
- **Location**: `app/_layout.tsx` (line 9, 91)
- **Description**: ThemeProvider for dark/light mode support using React Navigation themes

### Font Loading
- **Source**: Expo Fonts Guide
- **URL**: https://docs.expo.dev/guides/using-custom-fonts/
- **Location**: `app/_layout.tsx` (lines 4, 59-62)
- **Description**: Custom font loading with useFonts

### Splash Screen
- **Source**: Expo Splash Screen Guide
- **URL**: https://docs.expo.dev/guides/splash-screens/
- **Location**: `app/_layout.tsx` (lines 5, 50, 72-76)
- **Description**: Splash screen management and hiding logic

### Authentication
- **Source**: Firebase Auth Documentation
- **URL**: https://firebase.google.com/docs/auth/web/manage-users#get_the_currently_signed-in_user
- **Location**: `app/_layout.tsx` (lines 6, 110-142)
- **Description**: Authentication for navigation

- **Source**: Firebase Auth Documentation
- **URL**: https://firebase.google.com/docs/auth
- **Location**: `app/index.tsx` (lines 3, 39-75)
- **Description**: User sign in and sign up functionality

- **Source**: Firebase Auth Reference
- **URL**: https://firebase.google.com/docs/reference/js/auth#signout
- **Location**: `app/(tabs)/sign-out.tsx` (lines 3, 31-61)
- **Description**: User sign out functionality

### Firestore Operations
- **Source**: Firestore Documentation
- **URL**: https://firebase.google.com/docs/firestore/manage-data/add-data#set_a_document
- **Location**: `components/lib/tournaments.ts` (lines 35, 86-96)
- **Description**: User joining tournament using setDoc

- **Source**: Firestore Documentation
- **URL**: https://firebase.google.com/docs/firestore/query-data/listen
- **Location**: `app/(tabs)/my-leagues.tsx` (lines 3-4, 92-180)
- **Description**: Real-time listener for league memberships. Modified to handle multiple leagues and cleanup

- **Source**: Firestore Documentation
- **URL**: https://firebase.google.com/docs/firestore/manage-data/delete-data
- **Location**: `components/lib/leagues.ts` (deleteByQuery, deleteLeague)
- **Description**: Batch deletion in chunks; cascade delete for league, invites, and members to prevent stalling

### Firebase Storage (league image upload)
- **Source**: Firebase Documentation — Cloud Storage for Firebase Admin SDK
- **URL**: https://firebase.google.com/docs/storage/admin/start
- **Location**: `functions/src/index.ts` (uploadLeagueImage: bucket, file.save, default bucket)
- **Description**: Admin SDK storage use

- **Source**: Firebase Documentation — Callable functions
- **URL**: https://firebase.google.com/docs/functions/callable
- **Location**: `functions/src/index.ts` (uploadLeagueImage callable), `components/lib/leagues.ts` (httpsCallable)
- **Description**: Callable HTTPS function pattern; client calls with 

- **Source**: Stack Overflow — Firebase Admin Storage upload, how to find a download URL
- **URL**: https://stackoverflow.com/questions/71740015/firebase-admin-storage-upload-how-to-find-a-download-url
- **Location**: `functions/src/index.ts` (uploadLeagueImage: permanent URL via token, not signed URL)
- **Description**: Admin SDK has no `getDownloadURL()`; signed URLs are time-limited. Led to using `firebaseStorageDownloadTokens` metadata and building permanent URL `...?alt=media&token=...`.

- **Source**: Stack Overflow — How to get the default bucket name in Firebase Functions
- **URL**: https://stackoverflow.com/questions/73848542/how-to-get-the-default-bucket-name-in-firebase-functions
- **Location**: `functions/src/index.ts` (admin.initializeApp({ storageBucket }), bucket() with no args)
- **Description**: Specifying default bucket via `initializeApp({ storageBucket: "..." })` to fix “the specified bucket does not exist” when using `admin.storage().bucket()`.

- **Source**: Firebase Documentation — firebase-admin.storage package (Admin Node SDK)
- **URL**: https://firebase.google.com/docs/reference/admin/node/firebase-admin.storage
- **Location**: `functions/src/index.ts` (storage bucket, file metadata)
- **Description**: Admin Storage API reference for bucket, file, save, setMetadata.

- **Source**: A guide to Firebase Storage download URLs and tokens (Sentinel Stand)
- **URL**: https://www.sentinelstand.com/article/guide-to-firebase-storage-download-urls-and-tokens
- **Location**: `functions/src/index.ts` (firebaseStorageDownloadTokens, permanent URL format)
- **Description**: Explains persistent download URL format and `firebaseStorageDownloadTokens` custom metadata for permanent URLs (no 7-day signed-URL limit).

- **Source**: Stack Overflow — Uploading files to Firebase Storage using REST API
- **URL**: https://stackoverflow.com/questions/37631158/uploading-files-to-firebase-storage-using-rest-api
- **Location**: (historical) earlier REST attempt in `components/lib/leagues.ts`; superseded by callable.
- **Description**: REST upload pattern; used before switching to Cloud Function due to RN/device issues.

- **Source**: Expo GitHub — with-firebase-storage-upload example
- **URL**: https://github.com/expo/examples/blob/master/with-firebase-storage-upload/App.js
- **Location**: (historical) XHR blob + uploadBytes approach; superseded by callable.
- **Description**: Converting image-picker URI to Blob via XMLHttpRequest; referenced when fixing “creating blobs from arraybuffer”.

- **Source**: Firebase Documentation — Upload files with Cloud Storage on Web
- **URL**: https://firebase.google.com/docs/storage/web/upload-files
- **Location**: (reference) client upload methods and error handling.
- **Description**: `uploadBytes`, `uploadString`, metadata; informed move to callable after client errors.

- **Source**: Stack Overflow — React Native Firebase Storage base64 and blob not working
- **URL**: https://stackoverflow.com/questions/43514898/react-native-firebase-storage-base64-and-blob-not-working
- **Location**: (reference) context for RN Blob/ArrayBuffer limitations.
- **Description**: Led to Cloud Function with base64 instead of client upload.

### Score from image (Vision API)
- **Source**: Google Cloud Vision API
- **URL**: https://cloud.google.com/vision/docs
- **Location**: `functions/src/index.ts` (parseScoreFromImage, parseScoreFromImageHttp), `components/lib/scoreFromImage.ts`
- **Description**: Callable + HTTP function; reads text from scoreboard/screenshot image and returns suggested player1/player2 scores. Client uses HTTP endpoint with Bearer token for reliable auth on Expo/RN.

- **Source**: Cloud Vision API understanding chatgpt
- **URL**: https://chatgpt.com/share/69983db7-2f0c-8007-ba9c-5c97e6a15761
- **Location**: Bracket.tsx
- **Description**: Used GPT to get a better idea of how to implemenet the Api.

- **Source**: Firestore Documentation
- **URL**: https://firebase.google.com/docs/firestore
- **Location**: `components/lib/members.ts` (lines 1-252)
- **Description**: Member and invite management functions using Firestore operations

- **Source**: Firestore Documentation
- **URL**: https://firebase.google.com/docs/firestore/query-data/queries
- **Location**: `components/lib/members.ts` (lines 18-40)
- **Description**: User lookup by email using Firestore queries

- **Source**: Firestore Documentation
- **URL**: https://firebase.google.com/docs/firestore/query-data/get-data#get_multiple_documents_from_a_collection
- **Location**: `components/lib/members.ts` (lines 140-196)
- **Description**: List members and invites functions using Firestore queries

- **Source**: Firestore Documentation
- **URL**: https://firebase.google.com/docs/firestore/manage-data/add-data#update-data
- **Location**: `components/lib/members.ts` (lines 215-251)
- **Description**: Resend invite and set member role functions using Firestore setDoc with merge

- **Source**: Firestore Documentation
- **URL**: https://firebase.google.com/docs/firestore/query-data/get-data
- **Location**: `app/(tabs)/home.tsx` (lines 47-90), `app/league/[leagueId]/index.tsx` (lines 150-173)
- **Description**: League fetching and member list loading using Firestore queries

### Tournament Bracket Algorithm
- **Source**: gpt chat
- **URL**: https://chatgpt.com/share/6973b4c9-23c8-8007-98f1-d6533d1d01fe
- **Location**: `components/lib/tournaments.ts` (lines 276-277, 180-275)
- **Description**: Bracket generation algorithm. Adapted to handle byes and create placeholder matches for subsequent rounds

### Bracket Visualisation
- **Source**: GPT Convo
- **URL**: https://chatgpt.com/share/691dab97-d050-8007-9ba3-69de17a2cc4c
- **Location**: `app/league/[leagueId]/bracket.tsx` (lines 3, throughout bracket rendering)
- **Description**: Bracket visualisation styling and layout

### React Native Components
- **Source**: React Native Documentation
- **URL**: https://reactnative.dev/docs/scrollview
- **Location**: `app/league/[leagueId]/bracket.tsx` (lines 4, ScrollView usage)
- **Description**: ScrollView and Dimensions API usage

- **Source**: React Native Documentation
- **URL**: https://reactnative.dev/docs/flatlist
- **Location**: `app/(tabs)/home.tsx` (throughout), `app/league/[leagueId]/index.tsx` (throughout)
- **Description**: FlatList component for displaying lists

- **Source**: React Native Documentation
- **URL**: https://reactnative.dev/docs/refreshcontrol
- **Location**: `app/(tabs)/profile.tsx` (throughout)
- **Description**: RefreshControl for pull-to-refresh functionality

- **Source**: React Native Documentation
- **URL**: https://reactnative.dev/docs/keyboardavoidingview
- **Location**: `app/league/editleague.tsx` (lines 10, throughout)
- **Description**: KeyboardAvoidingView for handling keyboard interactions

### Bottom tab bar (Airbnb-style)
- **Source**: React Native Components — Airbnb Tabs
- **URL**: https://reactnativecomponents.com/components/tabs/airbnb-tabs
- **Location**: `components/ui/AnimatedTabBar.tsx` (throughout), `app/(tabs)/_layout.tsx` (tabBar prop, screenOptions animation/transitionSpec)
- **Description**: Custom bottom tab bar with sliding pill indicator, semi-transparent bar, and smooth animations. Pill uses react-native-reanimated (500ms, Easing.inOut(Easing.cubic)); tab screen transition uses same duration and easing (fade animation)

### Create-league walkthrough carousel
- **Source**: React Native Components — Fancy Carousel (Walkthrough)
- **URL**: https://reactnativecomponents.com/components/walkthrough/fancy-carousel
- **Location**: `components/ui/WalkthroughCarousel.tsx` (throughout), `app/(tabs)/my-leagues.tsx` (create tournament card)
- **Description**: Small-scale swipeable walkthrough above the create-league form: horizontal carousel with dot indicators and short tips (name your league, pick format, set options, invite after)

### Fancy login (login page UI)
- **Source**: React Native Components — Fancy Login
- **URL**: https://reactnativecomponents.com/components/login/fancy-login
- **Location**: `app/index.tsx` (login/sign-up form layout, header strip, form card, theme colours)
- **Description**: Login page layout inspired by Fancy Login: header strip with tint accent, form in a card with shadow and border, theme-aware colours (light/dark), KeyboardAvoidingView, and Sign in / Sign up toggle with accent styling

### Expo Vector Icons
- **Source**: Expo Vector Icons
- **URL**: https://icons.expo.fyi/Index
- **Location**: `app/_layout.tsx` (line 8), `app/(tabs)/_layout.tsx` (line 4)
- **Description**: FontAwesome icon library from Expo Vector

### JavaScript and TypeScript
- **Source**: W3Schools JavaScript Async/Await
- **URL**: https://www.w3schools.com/js/js_async.asp
- **Location**: `app/index.tsx`, `components/lib/tournaments.ts`, `components/lib/members.ts` (async/await usage)
- **Description**: Async/await pattern for sign-in, Firestore operations, and data loading

- **Source**: W3Schools JavaScript Array filter()
- **URL**: https://www.w3schools.com/jsref/jsref_filter.asp
- **Location**: `app/(tabs)/profile.tsx`, `app/notifications.tsx`, `components/lib/badges.ts` (filtering lists)
- **Description**: Array filter for filtering results and lists

- **Source**: W3Schools JavaScript Date toLocaleDateString()
- **URL**: https://www.w3schools.com/jsref/jsref_tolocaledatestring.asp
- **Location**: `app/(tabs)/profile.tsx` (formatDate), `app/league/[leagueId]/bracket.tsx`, `app/user/[userId].tsx`
- **Description**: Date formatting for tournament history and match dates

- **Source**: W3Schools React useState Hook
- **URL**: https://www.w3schools.com/react/react_usestate.asp
- **Location**: Throughout app and tab screens (e.g. `app/(tabs)/sign-out.tsx`, `app/league/[leagueId]/chat.tsx`)
- **Description**: State management with useState in React components

### League chat, badges, and email verification
- **Source**: Firestore Documentation
- **URL**: https://firebase.google.com/docs/firestore
- **Location**: `components/lib/chat.ts`, `app/league/[leagueId]/chat.tsx`
- **Description**: League chat messages stored in Firestore subcollection `leagueChats/{leagueId}/messages`

- **Source**: GPT Conversation
- **URL**: https://chatgpt.com/share/698628e4-3c08-8007-a920-17997d00bfde
- **Location**: `app/league/[leagueId]/chat.tsx` (throughout)
- **Description**: League chat UI layout and behaviour

- **Source**: Firestore Documentation
- **URL**: https://firebase.google.com/docs/firestore
- **Location**: `components/lib/badges.ts`, `components/ui/AchievementBadgeTile.tsx`
- **Description**: Badge definitions and earned badges stored in Firestore

- **Source**: GPT Conversation
- **URL**: https://chatgpt.com/share/69862ad5-9300-8007-9d95-100d9c6fc6b9
- **Location**: `components/ui/AchievementBadgeTile.tsx`, `components/lib/badges.ts` (badge UI)
- **Description**: Badge UI generation and layout

- **Source**: Firebase Auth Documentation
- **URL**: https://firebase.google.com/docs/auth
- **Location**: `app/verify-email.tsx`, `app/index.tsx`
- **Description**: Email verification using `sendEmailVerification` and `emailVerified`

### Profile avatars (DiceBear Bottts Neutral)
- **Source**: DiceBear Bottts Neutral style
- **URL**: https://www.dicebear.com/styles/bottts-neutral/
- **Location**: `components/lib/avatars.ts` (DICEBEAR_BASE, AVATAR_OPTIONS, getAvatarImageUrl)
- **Description**: Bottts Neutral avatar images for profile pictures (robot/character style by Pablo Stanley); each option uses a seed to generate a unique avatar.

- **Source**: DiceBear HTTP API
- **URL**: https://www.dicebear.com/how-to-use/http-api/
- **Location**: `components/lib/avatars.ts` (image URL format: `9.x/bottts-neutral/png?seed=...`)
- **Description**: Avatar images requested via HTTP API (PNG format)

**Files that use avatars / profile image:**
- `app/(tabs)/profile.tsx` – profile header avatar, tap to open AvatarPicker; Find friends list shows avatar/photo
- `app/user/[userId].tsx` – public profile avatar
- `app/league/[leagueId]/index.tsx` – member list avatars
- `app/league/[leagueId]/chat.tsx` – chat message sender avatars
- `components/ui/AvatarPicker.tsx` – modal grid of AVATAR_OPTIONS
- `components/lib/users.ts` – `avatarId` on PublicUserSummary, `updateMyAvatarId()`
- `components/lib/members.ts` – `avatarId` on ResolvedUser and when adding members
- `components/lib/chat.ts` – `avatarId` on ChatMessage when sending and when mapping messages

### Firebase Setup
1. Create Firebase project
2. Enable Authentication (Email/Password)
3. Create Firestore database
4. Set up Storage (default bucket) if using league cover images
5. Copy config to `FirebaseConfig.ts`
6. Deploy security rules: `firebase deploy --only firestore:rules`
7. Deploy Cloud Functions (league image upload via Storage, score-from-image via Vision API): `cd functions && npm run build && firebase deploy --only functions`
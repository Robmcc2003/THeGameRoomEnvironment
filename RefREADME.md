# The Game Room Environment — References
This document lists **all references, attributions, and documentation links** used in the project. For a short project overview and how to run the app, see [README.md](./README.md).

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
League creation, updates, and deletion.
### `components/lib/members.ts`
League member management, invites, and role assignments.

## Database Structure
### Collections
#### `users`
- `userId` (document ID)
- `email`, `username`, `displayName`
- `role` ('user' or 'admin')
- `createdAt`, `updatedAt`

#### `leagues`
- `leagueId` (document ID)
- `name`, `ownerId`, `admins`
- `tournamentFormat` ('single_elimination', 'double_elimination', 'round_robin', 'normal_league')
- `maxParticipants`, `description`
- `startDate`, `endDate`

#### `leagueMembers`
- `memberId` (document ID): `${leagueId}_${userId}`
- `leagueId`, `userId`
- `role` ('member' or 'admin')
- `status` ('active', 'invited', 'pending')
- `displayName`, `username`
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
### Firebase Configuration
- **Source**: YouTube Tutorial (2022)
- **URL**: https://youtu.be/a0KJ7l5sNGw?si=caznuBD8jCD2er9v
- **Location**: `FirebaseConfig.ts` (lines 1-37)
- **Description**: Firebase initialization, authentication setup, and Firestore configuration

### Firebase Analytics
- **Source**: Firebase Analytics Documentation
- **URL**: https://firebase.google.com/docs/analytics/get-started
- **Location**: `FirebaseConfig.ts` (lines 2, 23-35)
- **Description**: Firebase Analytics initialization and platform support checking

### Navigation and App Structure
- **Source**: Expo Router Documentation
- **URL**: https://docs.expo.dev/router/introduction/
- **Location**: `app/_layout.tsx` (lines 3, 11-109)
- **Description**: Navigation structure and routing setup

### React Navigation Theme
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
- **Location**: `components/lib/leagues.ts` (lines 13-36)
- **Description**: Batch deletion code adapted to delete documents in chunks. Cascade delete for league and related data

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

## Dev Setup
### Prerequisites
- Node.js
- Expo
- Firebase

### Firebase Setup
1. Create Firebase project
2. Enable Authentication (Email/Password)
3. Create Firestore database
4. Copy config to `FirebaseConfig.ts`
5. Deploy security rules: `firebase deploy --only firestore:rules`
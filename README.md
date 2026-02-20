# The Game Room Environment
A React Native (Expo) mobile app for running tournament leagues, brackets, and player statistics. Users can sign up, verify email, browse and join leagues, view brackets, submit and verify match scores, earn badges, find friends, and use league chat.

## Tech stack
- **React Native** with **Expo**
- **Expo Router** for file-based navigation
- **Firebase**: Authentication (email/password, email verification), **Firestore** (users, leagues, members, invites, matches, notifications, chat)
- **TypeScript**

### Prerequisites
- Node.js
- Expo CLI (or use `npx expo`)
- A Firebase project with Authentication (Email/Password) and Firestore enabled

### Install and run
```bash
npm install
npx expo start
```

### Firebase setup
1. Create a Firebase project and enable **Authentication** (Email/Password) and **Firestore**.
2. Copy your Firebase config into `FirebaseConfig.ts`.
3. Deploy Firestore rules: `firebase deploy --only firestore:rules`

## Project structure (HL)
- **`app/`** – Expo Router screens: login (`index`), tabs (Sign Out, Home, Profile, My Leagues), verify-email, notifications, league detail/bracket/chat/edit/add-member, user profile.
- **`components/`** – Shared UI (Logo, Themed, AppCard, AppButton, AppInput, AppBadge, AchievementBadgeTile) and hooks (useColorScheme, useAppTheme).
- **`components/lib/`** – Logic and Firestore: tournaments, leagues, members, users, badges, chat, notifications, gameTypes.
- **`constants/Colors.ts`** – Light/dark colour palette.
- **`FirebaseConfig.ts`** – Firebase app, auth, Firestore, analytics init.

## References and attributions
**All references, documentation links, and attributions are listed in [RefREADME.md](./RefREADME.md).** That document includes:

- Firebase (config, auth, Firestore, analytics)
- Expo (Router, fonts, splash screen)
- React Navigation (themes)
- Firestore (queries, listeners, batch delete, etc.)
- Tournament bracket algorithm and bracket visualisation
- React Native (ScrollView, FlatList, RefreshControl, KeyboardAvoidingView)
- Expo Vector Icons
See **RefREADME.md** for full citations and file/line references.

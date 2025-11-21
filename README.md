
## Tech Stack

- **React Native**: Mobile app framework  https://reactnative.dev/
- **Expo**: Development platform for React Native  https://expo.dev/
- **Firebase**: Backend services (Authentication, Firestore)  https://firebase.google.com/
- **TypeScript**: Typed JavaScript  https://www.typescriptlang.org/

## References and Documentation

### Firebase
- **Firebase Documentation**: https://firebase.google.com/docs
- **Firebase Auth**: https://firebase.google.com/docs/auth and https://youtu.be/a0KJ7l5sNGw?si=caznuBD8jCD2er9v
- **Firestore**: https://firebase.google.com/docs/firestore
- **Firestore Security Rules**: https://firebase.google.com/docs/firestore/security/get-started

### React Native & Expo
- **React Native**: https://reactnative.dev/
- **Expo**: https://docs.expo.dev/
- **Expo Router**: https://docs.expo.dev/router/introduction/

### React
- **React Documentation**: https://react.dev/

### Dummy tournament data to display bracket created w chat gpt
- https://chatgpt.com/share/691d9c29-51dc-8007-89a4-3ece7fb2cada
### logo generated with the help of chat gpt 
- https://chatgpt.com/share/691da1e5-7c44-8007-9135-608c82d9689c
### styling for the bracket screen
- https://chatgpt.com/share/691dab97-d050-8007-9ba3-69de17a2cc4c

## Key Files

### components/lib/tournaments.ts
This file contains all tournament-related functions:
- `joinTournament()`: Allows users to join a tournament
- `getTournamentBracket()`: Retrieves all matches for a tournament
- `generateBracketMatches()`: Automatically creates bracket matches
- `getTournamentStandings()`: Calculates win/loss statistics

**Key Concepts:**
- Single-elimination tournaments: Players are eliminated after losing
- Bracket generation: Automatically pairs players and creates match structure
- Byes: Free passes for players when there's an odd number of participants
- Standings: Calculated by counting wins and losses

## Database Structure

### Collections

#### users
Stores user profiles:
- `userId` (document ID): Unique user identifier
- `email`: User's email address
- `username`: User's chosen username
- `displayName`: Name shown in tournaments
- `createdAt`: When account was created
- `updatedAt`: When profile was last updated

#### leagues
Stores tournament/league information:
- `leagueId` (document ID): Unique league identifier
- `name`: League name
- `ownerId`: User ID of the creator
- `admins`: Array of admin user IDs
- `tournamentFormat`: Type of tournament (single_elimination, etc.)
- `maxParticipants`: Maximum number of players
- `description`: League description
- `startDate`, `endDate`: Tournament dates

#### leagueMembers
Tracks who has joined each league:
- `memberId` (document ID): `${leagueId}_${userId}`
- `leagueId`: Which league
- `userId`: Which user
- `role`: 'member' or 'admin'
- `status`: 'active', 'invited', or 'pending'
- `displayName`: User's display name
- `username`: User's username
- `joinedAt`: When they joined

#### tournamentMatches
Stores individual matches:
- `matchId` (document ID): `${leagueId}_r${round}_m${matchNumber}`
- `leagueId`: Which tournament
- `round`: Round number (1, 2, 3, etc.)
- `matchNumber`: Match number within that round
- `player1Id`: First player's user ID
- `player2Id`: Second player's user ID (null if TBD or bye)
- `status`: 'pending', 'in_progress', or 'completed'
- `result`: Match result (scores, winner)
- `createdAt`: When match was created
- `completedAt`: When match was completed

#### leagueInvites
Stores invitations for users who haven't signed up yet:
- `inviteId` (document ID): `${leagueId}_${emailLower}`
- `leagueId`: Which league
- `emailLower`: Invited email address (lowercase)
- `status`: 'pending', 'accepted', or 'declined'
- `createdAt`: When invite was sent

## Security Model

### Authentication
- Users must sign in to use the app
- Authentication is handled by Firebase Auth
- User sessions are stored in memory (not persistent)

### Authorisations currently
- **Users**: Can read their own profile, read leagues, join tournaments
- **League Owners**: Can create/update/delete their leagues, manage members, generate matches
- **League Admins**: Can update leagues, manage members, generate matches
- **All Authenticated Users**: Can read leagues, members, and matches (to view brackets)

## Dev Setup
### Prerequisites
- Node.js installed
- Expo CLI installed
- Firebase project created
- Firebase credentials configured
### Installation
```bash
npm install
```
### Running the App
```bash
npx expo start
```
### Firebase Setup
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication (Email/Password)
3. Create Firestore database
4. Copy your Firebase config to `FirebaseConfig.ts`
5. Deploy security rules: `firebase deploy --only firestore:rules`

## Common Tasks

### Adding a New Tournament Format
1. Update `tournamentFormat` type in league documents
2. Add generation logic in `generateBracketMatches()` if needed
3. Update bracket display logic in `bracket.tsx`

### Adding New Match Fields
1. Update `Match` type in `tournaments.ts`
2. Update match creation in `generateBracketMatches()`
3. Update match display in `bracket.tsx`
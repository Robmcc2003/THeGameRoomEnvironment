// fixed set of Bottts Neutral avatars from DiceBear; store avatarId in Firestore, derive URL from it
// ref: DiceBear Bottts - https://www.dicebear.com/styles/bottts-neutral/
// ref: DiceBear API - https://www.dicebear.com/how-to-use/http-api/
const DICEBEAR_BASE = 'https://api.dicebear.com/9.x/bottts-neutral/png';

export type AvatarOption = {
  id: string;
  name: string;
};

// predefined picker options; each id used as DiceBear seed
export const AVATAR_OPTIONS: AvatarOption[] = [
  // Core player identities
  { id: 'player', name: 'Player' },
  { id: 'pro-gamer', name: 'Pro gamer' },
  { id: 'noob', name: 'Rookie' },
  { id: 'tryhard', name: 'Try-hard' },
  { id: 'sweaty', name: 'Sweaty' },
  { id: 'clutch-king', name: 'Clutch king' },

  // Soldiers / shooters
  { id: 'soldier', name: 'Soldier' },
  { id: 'sniper', name: 'Sniper' },
  { id: 'commander', name: 'Commander' },
  { id: 'medic', name: 'Medic' },
  { id: 'scout', name: 'Scout' },
  { id: 'demolition', name: 'Demolition' },

  // Fantasy heroes
  { id: 'wizard', name: 'Wizard' },
  { id: 'warrior', name: 'Warrior' },
  { id: 'archer', name: 'Archer' },
  { id: 'assassin', name: 'Assassin' },
  { id: 'paladin', name: 'Paladin' },
  { id: 'necromancer', name: 'Necromancer' },

  // Historical / mythic
  { id: 'viking', name: 'Viking' },
  { id: 'samurai', name: 'Samurai' },
  { id: 'ronin', name: 'Ronin' },
  { id: 'gladiator', name: 'Gladiator' },
  { id: 'knight', name: 'Knight' },
  { id: 'pirate', name: 'Pirate' },

  // Sports & casual
  { id: 'footballer', name: 'Footballer' },
  { id: 'striker', name: 'Striker' },
  { id: 'goalkeeper', name: 'Goalkeeper' },
  { id: 'basketballer', name: 'Basketballer' },
  { id: 'runner', name: 'Runner' },
  { id: 'coach', name: 'Coach' },

  // Fun / mascots
  { id: 'fox', name: 'Fox' },
  { id: 'panda', name: 'Panda' },
  { id: 'tiger', name: 'Tiger' },
  { id: 'dragon', name: 'Dragon' },
  { id: 'ninja', name: 'Ninja' },
  { id: 'robot', name: 'Robot' },
];

// return image URL for avatar id, or null if missing
export function getAvatarImageUrl(avatarId: string | null | undefined): string | null {
  if (!avatarId || typeof avatarId !== 'string') return null;
  return `${DICEBEAR_BASE}?seed=${encodeURIComponent(avatarId)}`;
}

// user shape for profile image: photoURL first, then avatarId
export type ProfileImageUser = {
  photoURL?: string | null;
  avatarId?: string | null;
};

// best profile image URL: custom photo first, then avatar, else null
export function getProfileImageUrl(user: ProfileImageUser | null | undefined): string | null {
  if (!user) return null;
  if (user.photoURL && typeof user.photoURL === 'string') return user.photoURL;
  return getAvatarImageUrl(user.avatarId);
}

// game-specific tournament types and scoring systems; each game has its own rules and result shape

export type GameType = 'FIFA' | 'MADDEN' | 'NBA_2K' | 'CALL_OF_DUTY' | 'GENERIC';

export interface GameConfig {
  id: GameType;
  name: string;
  description: string;
  scoringFields: ScoringField[];
  determineWinner: (scores: Record<string, any>) => string | null; // Returns 'player1' or 'player2' or null for tie
}

export interface ScoringField {
  id: string;
  label: string;
  type: 'number' | 'text';
  required: boolean;
  placeholder?: string;
}

// FIFA: goals as primary metric
const fifaConfig: GameConfig = {
  id: 'FIFA',
  name: 'FIFA',
  description: 'Football/soccer matches - score based on goals',
  scoringFields: [
    { id: 'goals', label: 'Goals', type: 'number', required: true, placeholder: 'Goals scored' },
    { id: 'assists', label: 'Assists (Optional)', type: 'number', required: false, placeholder: 'Assists' },
  ],
  determineWinner: (scores) => {
    const p1Goals = scores.player1?.goals ?? 0;
    const p2Goals = scores.player2?.goals ?? 0;
    if (p1Goals > p2Goals) return 'player1';
    if (p2Goals > p1Goals) return 'player2';
    return null; // Tie
  },
};

// MADDEN: points as primary metric
const maddenConfig: GameConfig = {
  id: 'MADDEN',
  name: 'Madden NFL',
  description: 'American football matches - score based on points',
  scoringFields: [
    { id: 'points', label: 'Points', type: 'number', required: true, placeholder: 'Total points' },
    { id: 'touchdowns', label: 'Touchdowns (Optional)', type: 'number', required: false, placeholder: 'Touchdowns' },
  ],
  determineWinner: (scores) => {
    const p1Points = scores.player1?.points ?? 0;
    const p2Points = scores.player2?.points ?? 0;
    if (p1Points > p2Points) return 'player1';
    if (p2Points > p1Points) return 'player2';
    return null; // Tie
  },
};

// NBA 2K: points as primary, optional rebounds/assists
const nba2kConfig: GameConfig = {
  id: 'NBA_2K',
  name: 'NBA 2K',
  description: 'Basketball matches - score based on points',
  scoringFields: [
    { id: 'points', label: 'Points', type: 'number', required: true, placeholder: 'Total points' },
    { id: 'rebounds', label: 'Rebounds (Optional)', type: 'number', required: false, placeholder: 'Rebounds' },
    { id: 'assists', label: 'Assists (Optional)', type: 'number', required: false, placeholder: 'Assists' },
  ],
  determineWinner: (scores) => {
    const p1Points = scores.player1?.points ?? 0;
    const p2Points = scores.player2?.points ?? 0;
    if (p1Points > p2Points) return 'player1';
    if (p2Points > p1Points) return 'player2';
    return null; // Tie
  },
};

// CALL OF DUTY: kills and optional objectives
const codConfig: GameConfig = {
  id: 'CALL_OF_DUTY',
  name: 'Call of Duty',
  description: 'First-person shooter matches - score based on kills and objectives',
  scoringFields: [
    { id: 'kills', label: 'Kills', type: 'number', required: true, placeholder: 'Total kills' },
    { id: 'deaths', label: 'Deaths (Optional)', type: 'number', required: false, placeholder: 'Deaths' },
    { id: 'objectives', label: 'Objective Points (Optional)', type: 'number', required: false, placeholder: 'Objective points' },
  ],
  determineWinner: (scores) => {
    const p1Kills = scores.player1?.kills ?? 0;
    const p2Kills = scores.player2?.kills ?? 0;
    const p1Objectives = scores.player1?.objectives ?? 0;
    const p2Objectives = scores.player2?.objectives ?? 0;
    
    // Primary: kills, secondary: objectives
    const p1Total = p1Kills * 100 + p1Objectives;
    const p2Total = p2Kills * 100 + p2Objectives;
    
    if (p1Total > p2Total) return 'player1';
    if (p2Total > p1Total) return 'player2';
    return null; // Tie
  },
};

// GENERIC: fallback scoring when game type not configured
const genericConfig: GameConfig = {
  id: 'GENERIC',
  name: 'Generic',
  description: 'Standard scoring system - higher score wins',
  scoringFields: [
    { id: 'score', label: 'Score', type: 'number', required: true, placeholder: 'Match score' },
  ],
  determineWinner: (scores) => {
    const p1Score = scores.player1?.score ?? 0;
    const p2Score = scores.player2?.score ?? 0;
    if (p1Score > p2Score) return 'player1';
    if (p2Score > p1Score) return 'player2';
    return null; // Tie
  },
};

// all game configs in a map for lookup
export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  FIFA: fifaConfig,
  MADDEN: maddenConfig,
  NBA_2K: nba2kConfig,
  CALL_OF_DUTY: codConfig,
  GENERIC: genericConfig,
};

// get game config by type, default to GENERIC if not found
export function getGameConfig(gameType: string | null | undefined): GameConfig {
  if (!gameType) return GAME_CONFIGS.GENERIC;
  const upperType = gameType.toUpperCase().replace(/\s+/g, '_') as GameType;
  return GAME_CONFIGS[upperType] || GAME_CONFIGS.GENERIC;
}

// get all available game types
export function getAvailableGameTypes(): GameConfig[] {
  return Object.values(GAME_CONFIGS);
}

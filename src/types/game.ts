export type ScreenState =
  | 'TITLE_MENU'
  | 'PLAYER_SETUP'
  | 'WORLD_MAP'
  | 'BATTLE_ARENA'
  | 'CHAMPION_CELEBRATION'
  | 'RESULTS'
  | 'TEACHER_PANEL'
  | 'JOIN_CLASS';

export type QuestionType = 'pilihan_ganda' | 'benar_salah' | 'isian' | 'uraian';
export type Difficulty = 'mudah' | 'sedang' | 'sulit';
export type VerificationStatus =
  | 'tervalidasi_guru'
  | 'tervalidasi_otomatis'
  | 'perlu_tinjau';

export interface Question {
  id: string;
  subject: string;
  gradeLevel: string;
  topic: string;
  subtopic: string;
  indicator: string;
  sourceDoc: string;
  sourcePage?: string;
  difficulty: Difficulty;
  type: QuestionType;
  prompt: string;
  diagramType?: 'segitiga_siku' | 'persegi_panjang' | 'lingkaran' | 'kubus' | 'sudut';
  diagramData?: Record<string, string | number>;
  options?: string[];
  correctAnswer: string;
  acceptedAlternatives?: string[];
  numericValue?: number;
  unit?: string;
  tolerance?: number;
  explanation: string;
  rubric?: string;
  baseScore: number;
  estimatedSeconds: number;
  tags: string[];
  verificationStatus: VerificationStatus;
  isAiGenerated?: boolean;
  isDemo?: boolean;
}

export type HeroId = 'ksatria' | 'penyihir' | 'penjelajah' | 'penjaga_hutan';
export type AttackStyle = 'tebasan' | 'bola_energi' | 'panah_cahaya' | 'mantra_angka';

export interface HeroAccessory {
  id: string;
  name: string;
  cost: number;
  description: string;
  slot: 'head' | 'aura';
}

export interface HeroDef {
  id: HeroId;
  visualId?: HeroId;
  name: string;
  archetype: string;
  title: string;
  description: string;
  attackName: string;
  attackStyle: AttackStyle;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  baseHp: number;
  baseAttack: number;
}

export type MonsterArchetype =
  | 'slime_angka'
  | 'raja_slime'
  | 'kelelawar_pecahan'
  | 'golem_pecahan'
  | 'penjaga_sudut'
  | 'naga_geometri'
  | 'serigala_persamaan'
  | 'raksasa_aljabar'
  | 'burung_teka_teki'
  | 'penyihir_logika'
  | 'raja_matematika';

export interface MonsterDef {
  id: string;
  name: string;
  archetype: MonsterArchetype;
  tier: 'reguler' | 'miniboss' | 'boss';
  maxHp: number;
  attackPower: number;
  attackPattern: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  isCustom?: boolean;
}

export interface LevelDef {
  id: string;
  name: string;
  monsterId: string;
  questionCount: number;
  difficulty: Difficulty | 'campuran';
  topicFilter: string;
  indicatorFilter?: string;
  rewardXp: number;
  rewardCoins: number;
}

export interface AreaDef {
  id: string;
  name: string;
  order: number;
  mathTopic: string;
  description: string;
  gradeRecommendation: string;
  bgImage: string;
  fallbackGradient: string;
  accentColor: string;
  mapPos: { x: number; y: number };
  unlockedByDefault: boolean;
  prerequisiteAreaId?: string;
  levels: LevelDef[];
  isCustom?: boolean;
}

export interface GameSettings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  volume: number;
  animationQuality: 'penuh' | 'hemat';
  reducedMotion: boolean;
  textSize: 'normal' | 'besar';
  highContrast: boolean;
  timerEnabled: boolean;
  secondsPerQuestion: number;
  allowHints: boolean;
  allowSecondChance: boolean;
  showExplanationOnWrong: boolean;
  showPublicLeaderboard: boolean;
  baseScore: number;
  difficultyBonus: boolean;
  timeBonusEnabled: boolean;
  unlockAllAreas: boolean;
  monsterHpMultiplier: number;
  teacherPin: string;
}

export interface PlayerProfile {
  name: string;
  className: string;
  heroId: HeroId;
  xp: number;
  level: number;
  coins: number;
  unlockedAccessories: string[];
  equippedAccessory: string | null;
  badges: string[];
  completedLevels: Record<
    string,
    {
      stars: number;
      bestMasteryPct: number;
      attempts: number;
    }
  >;
  unlockedAreaIds: string[];
}

export interface QuestionAttemptLog {
  questionId: string;
  prompt: string;
  topic: string;
  indicator: string;
  type: QuestionType;
  difficulty: Difficulty;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  pendingTeacherReview?: boolean;
  teacherScorePct?: number;
  teacherNote?: string;
  timeSpentSec: number;
  usedHint: boolean;
}

export interface IndicatorSummary {
  indicator: string;
  topic: string;
  total: number;
  correct: number;
  accuracyPct: number;
}

export interface AttemptRecord {
  id: string;
  studentName: string;
  className: string;
  mode: 'solo' | 'local_team' | 'online_class';
  areaId: string;
  areaName: string;
  levelId: string;
  levelName: string;
  heroId: HeroId;
  dateIso: string;
  durationSec: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  gameScore: number;
  academicMasteryPct: number;
  xpEarned: number;
  coinsEarned: number;
  wonBattle: boolean;
  indicatorStats: IndicatorSummary[];
  questionLogs: QuestionAttemptLog[];
}

export interface LocalTeamConfig {
  teamAName: string;
  teamBName: string;
  teamAHero: HeroId;
  teamBHero: HeroId;
  areaId: string;
  topicFilter: string;
  questionCountPerTeam: number;
  difficulty: Difficulty | 'campuran';
}

export interface OnlineRoomSummary {
  code: string;
  title: string;
  areaName: string;
  topicFilter: string;
  difficulty: Difficulty | 'campuran';
  questionCount: number;
  durationPerQuestionSec: number;
  allowHints: boolean;
  showPublicLeaderboard: boolean;
  status: 'LOBBY' | 'ACTIVE' | 'ENDED';
  createdAt: string;
  participants: Array<{
    id: string;
    name: string;
    heroId: HeroId;
    score: number;
    correctCount: number;
    answeredCount: number;
    connected: boolean;
  }>;
}

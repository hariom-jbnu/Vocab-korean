
export interface VocabItem {
  /** Stable id used to store progress (the Korean headword). */
  id: string;
  ko: string;
  hi: string;
  en: string;
}

export interface VisibilitySettings {
  ko: boolean;
  hi: boolean;
  en: boolean;
}

export enum ThemeType {
  TEAL = 'TEAL',
  NAVY = 'NAVY',
  PINK = 'PINK'
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  cardBg: string;
}

export interface Settings {
  voiceName: string;
  rate: number;
  pitch: number;
  autoSpeak: boolean;
  theme: ThemeType;
  isRandom: boolean;
  cardBg: string;
  /** New words introduced per study day. */
  newPerDay: number;
  /** Answers per day the learner aims for. */
  dailyGoal: number;
  /** FSRS desired retention, 0.7 to 0.97. */
  retention: number;
  /** Seed for this learner's shuffled new-word order. */
  seed: number;
  /** Quiz checks the answer for you; flip lets you rate yourself. */
  answerMode: 'quiz' | 'flip';
  /** Include the typing round for well-known words (needs a Korean keyboard). */
  typeAnswers: boolean;
}

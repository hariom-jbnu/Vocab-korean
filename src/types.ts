
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
}

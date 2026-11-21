/**
 * Domain types shared by the server and the website.
 *
 * Nothing here knows about SQLite, files or HTTP, so the same types work
 * unchanged when storage moves to a cloud database later.
 */
import type { DeckRules, RuleOverrides } from './rules';

export type { DeckRules, RuleOverrides };

/** Moderation state of a deck, card or creator. */
export type ModerationStatus = 'active' | 'flagged' | 'hidden';
export const MODERATION_STATUSES: readonly ModerationStatus[] = ['active', 'flagged', 'hidden'];

/** The four practice skills. */
export type SkillMode = 'vocab' | 'reading' | 'listening' | 'writing';
export const SKILL_MODES: readonly SkillMode[] = ['vocab', 'reading', 'listening', 'writing'];

/** Who can find a deck: listed on the creator page, or only by its code. */
export type Visibility = 'public' | 'unlisted';

/**
 * How a language is written, so any language works without special code:
 * the script decides how typed answers are compared and split into tiles.
 */
export interface ScriptMeta {
  /** ISO 15924 script code: Hang (Korean), Latn, Deva (Hindi), Jpan, Hani, Arab, Cyrl, ... */
  script: string;
  direction: 'ltr' | 'rtl';
  /** Name of the reading aid shown as a hint: Romanization, Pinyin, Romaji, Transliteration. */
  readingLabel: string;
  /** BCP 47 language for text-to-speech, when it differs from the deck's target language. */
  ttsLang?: string;
  /** Typed answers must match upper and lower case. Default false. */
  caseSensitive?: boolean;
}

/** Top-bar branding for a creator, optionally overridden per deck. */
export interface Branding {
  /** Big title in the top bar, e.g. "Learn Korean with Ravi". */
  title?: string;
  /** Small line under the title, e.g. "Words from episode 12". */
  note?: string;
  /** Short badge text, e.g. "TOPIK I". */
  badge?: string;
  /** Uploaded logo (a media id). */
  logoMediaId?: string;
  /** Accent color as #rrggbb. */
  color?: string;
}

export interface Example {
  /** Sentence in the target language. */
  text: string;
  /** Translation in the learner's language. */
  translation?: string;
  /** Reading aid for the sentence (romanization etc.). */
  reading?: string;
}

export interface Creator {
  id: string;
  /** Lowercase handle used in /@slug links and slug.localhost subdomains. */
  slug: string;
  displayName: string;
  branding: Branding;
  ownerUserId: string;
  moderationStatus: ModerationStatus;
  createdAt: string;
}

export interface Deck {
  id: string;
  creatorId: string;
  /** Unique 4-character share code, e.g. A7K9. */
  code: string;
  title: string;
  description: string;
  /** BCP 47 code of the language being learned, e.g. "ko". */
  targetLang: string;
  /** BCP 47 code of the learner's language (meanings), e.g. "en". */
  sourceLang: string;
  /** Optional second meaning language, e.g. "hi" for Korean with English and Hindi. */
  altLang?: string;
  scriptMeta: ScriptMeta;
  /** Only the rules the teacher changed. Use resolveRules() to get the full set. */
  ruleOverrides: RuleOverrides;
  /** Deck-level branding, laid over the creator's branding. */
  branding: Branding;
  visibility: Visibility;
  moderationStatus: ModerationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  deckId: string;
  position: number;
  /** The word or phrase in the target language. */
  term: string;
  /** Reading aid for the term (romanization, pinyin, transliteration). */
  reading?: string;
  /** Meaning in the learner's language. Separate meanings with commas. */
  meaning: string;
  /** Meaning in the deck's second language, if any. */
  meaningAlt?: string;
  /** Part of speech, used to pick fair wrong options: noun, verb, adjective, ... */
  pos?: string;
  topic?: string;
  examples: Example[];
  audioMediaId?: string;
  imageMediaId?: string;
  /** A teacher's own writing task for this card, e.g. "Write a sentence with this word". */
  writingPrompt?: string;
  moderationStatus: ModerationStatus;
}

export type UserKind = 'guest' | 'member';
export type UserRole = 'learner' | 'admin';

export interface User {
  id: string;
  kind: UserKind;
  role: UserRole;
  username?: string;
  displayName: string;
  email?: string;
  createdAt: string;
}

/** What a report points at. */
export type ReportTarget = 'deck' | 'card';
export type ReportReason = 'spam' | 'offensive' | 'wrong' | 'copyright' | 'other';
export const REPORT_REASONS: readonly ReportReason[] = ['spam', 'offensive', 'wrong', 'copyright', 'other'];

export interface Report {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  /** Deck the target belongs to, so a creator or admin can find it. */
  deckId: string;
  reason: ReportReason;
  note?: string;
  reporterId?: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

/** A deck as learners see it: full rules, merged branding, active cards only. */
export interface PracticeDeck {
  deck: Omit<Deck, 'ruleOverrides'>;
  rules: DeckRules;
  branding: Branding;
  creator: Pick<Creator, 'slug' | 'displayName'>;
  cards: Card[];
}

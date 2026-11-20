import { describe, expect, it } from 'vitest';
import { findWordInSentence, parsePlanFile, parsePlanFiles, topicFromHeader } from './planWords';

const DAY = `# Source: image/day-20.png "Day 20 Clothes, Fashion & Accessories". Some words are left out.
# A second comment line.
셔츠|syeocheu|शर्ट|shirt|흰 셔츠를 입었어요.|सफ़ेद शर्ट पहनी।|셔츠를 다려야 해요.|शर्ट प्रेस करनी है।
눈#2|nun|आँख|eye|눈이 커요.|आँखें बड़ी हैं।|눈을 감으세요.|आँखें बंद कीजिए।
broken|line
`;

describe('parsePlanFile', () => {
  it('reads words, examples, topic and source from a day file', () => {
    const words = parsePlanFile('../../data/plan/day-20.txt', DAY);
    expect(words).toHaveLength(2);
    expect(words[0]).toMatchObject({
      id: '셔츠',
      ko: '셔츠',
      rom: 'syeocheu',
      hi: 'शर्ट',
      en: 'shirt',
      source: 'image',
      topic: 'Clothes, Fashion & Accessories',
    });
    expect(words[0].examples).toEqual([
      { ko: '흰 셔츠를 입었어요.', hi: 'सफ़ेद शर्ट पहनी।' },
      { ko: '셔츠를 다려야 해요.', hi: 'शर्ट प्रेस करनी है।' },
    ]);
  });

  it('keeps the "#2" in the id but not in the word shown', () => {
    const [, eye] = parsePlanFile('day-19.txt', DAY);
    expect(eye.id).toBe('눈#2');
    expect(eye.ko).toBe('눈');
  });

  it('marks fill files as common words without a topic', () => {
    const [w] = parsePlanFile('fill-01.txt', DAY);
    expect(w.source).toBe('common');
    expect(w.topic).toBeUndefined();
  });
});

describe('parsePlanFiles', () => {
  it('reads files in name order and keeps the first copy of an id', () => {
    const words = parsePlanFiles({ 'fill-01.txt': '셔츠|a|b|c|d|e|f|g', 'day-20.txt': DAY });
    expect(words.map((w) => w.id)).toEqual(['셔츠', '눈#2']);
    expect(words[0].source).toBe('image');
  });
});

describe('topicFromHeader', () => {
  it('drops the day number', () => {
    expect(topicFromHeader('# Source: "Day 3 Food & Drinks"')).toBe('Food & Drinks');
    expect(topicFromHeader('# Source: "Day 14: Basic Verbs"')).toBe('Basic Verbs');
    expect(topicFromHeader('no header')).toBeUndefined();
  });
});

describe('findWordInSentence', () => {
  it('finds the word itself', () => {
    expect(findWordInSentence('흰 셔츠를 입었어요.', '셔츠')).toEqual([2, 4]);
  });

  it('finds a verb stem at the start of a word', () => {
    expect(findWordInSentence('밥을 먹었어요.', '먹다')).toEqual([3, 4]);
    expect(findWordInSentence('공부해요.', '공부하다')).toEqual([0, 2]);
  });

  it('gives up on irregular forms', () => {
    expect(findWordInSentence('음악을 들어요.', '듣다')).toBeNull();
  });
});

describe('the word files in data/plan', () => {
  const files = import.meta.glob('../../data/plan/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<
    string,
    string
  >;
  const words = parsePlanFiles(files);

  it('hold 2,000 different words', () => {
    expect(words).toHaveLength(2000);
    expect(new Set(words.map((w) => w.id)).size).toBe(2000);
  });

  it('give every word a meaning and two examples', () => {
    for (const w of words) {
      expect(w.hi && w.en && w.rom, w.id).toBeTruthy();
      expect(w.examples, w.id).toHaveLength(2);
    }
  });

  it('have every line in the 8-field format', () => {
    for (const [name, text] of Object.entries(files)) {
      for (const line of text.split('\n')) {
        if (!line.trim() || line.startsWith('#')) continue;
        expect(line.split('|'), `${name}: ${line}`).toHaveLength(8);
      }
    }
  });

  it('include about 1,000 words from the study images, each with a topic', () => {
    const fromImages = words.filter((w) => w.source === 'image');
    expect(fromImages.length).toBeGreaterThan(900);
    expect(fromImages.every((w) => w.topic)).toBe(true);
  });
});

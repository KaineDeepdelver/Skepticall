import { generatePhrase, phraseWords, normalizePhrase, confirmationPositions, confirmationMatches, PHRASE_WORDS } from './recoveryPhrase';
import WORDS from './wordlist';
import { webcrypto } from 'crypto';

test('the word list is the expected size, with no duplicates and no hyphens', () => {
  expect(WORDS).toHaveLength(7772);
  expect(new Set(WORDS).size).toBe(7772);
  expect(WORDS.every((w) => /^[a-z]+$/.test(w))).toBe(true);
});

test('a phrase has six words, all from the list, and two phrases differ', async () => {
  const a = await generatePhrase(PHRASE_WORDS, webcrypto);
  const b = await generatePhrase(PHRASE_WORDS, webcrypto);
  const words = a.split(' ');
  expect(words).toHaveLength(6);
  words.forEach((w) => expect(WORDS).toContain(w));
  expect(a).not.toBe(b);
});

test('selection is uniform: no word is favoured, and biased values are rejected', async () => {
  // A generator that first returns a value in the biased tail, then a good one: the tail value must be skipped.
  const n = WORDS.length;
  const limit = Math.floor(0x100000000 / n) * n;
  const sequence = [limit + 5, 0xffffffff, 7];
  const fake = { getRandomValues: (buf) => { buf[0] = sequence.shift(); return buf; } };
  const phrase = await generatePhrase(1, fake);
  expect(phrase).toBe(WORDS[7 % n]);
  expect(sequence).toHaveLength(0);

  const counts = new Map();
  const phrases = await Promise.all(Array.from({ length: 400 }, () => generatePhrase(6, webcrypto)));
  phrases.forEach((p) => p.split(' ').forEach((w) => counts.set(w, (counts.get(w) || 0) + 1)));
  expect(Math.max(...counts.values())).toBeLessThan(10); // 2,400 draws from 7,772 words: nothing repeats much
});

test('typing a phrase back is forgiving about case and separators, and gives one canonical form', () => {
  const canonical = 'river candle moon tree anchor planet';
  [
    'river candle moon tree anchor planet',
    'River  Candle MOON tree\nanchor planet ',
    'river-candle-moon-tree-anchor-planet',
    'river, candle, moon, tree, anchor, planet',
    '  river_candle.moon tree-anchor planet  ',
  ].forEach((input) => expect(normalizePhrase(input)).toBe(canonical));
  expect(phraseWords('')).toEqual([]);
  expect(phraseWords(null)).toEqual([]);
});

test('the check asks for two different words, and only accepts the right ones', () => {
  for (let i = 0; i < 100; i++) {
    const [a, b] = confirmationPositions(6, webcrypto);
    expect(a).toBeLessThan(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(6);
  }
  const phrase = 'river candle moon tree anchor planet';
  expect(confirmationMatches(phrase, { 1: 'candle', 4: ' Anchor ' })).toBe(true);
  expect(confirmationMatches(phrase, { 1: 'candle', 4: 'planet' })).toBe(false);
  expect(confirmationMatches(phrase, { 1: '', 4: 'anchor' })).toBe(false);
  expect(confirmationMatches(phrase, {})).toBe(false);
});

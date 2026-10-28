/**
 * Recovery phrases: six random words that lock the account's key backup.
 *
 * Six words from a 7,772-word list is about 77 bits. With the deliberately slow key derivation the backup
 * format uses (Argon2id), that is far beyond what anyone can guess offline, even with a copy of the locked
 * backup. People are given a phrase instead of choosing a passphrase because chosen passphrases are weak.
 */

export const PHRASE_WORDS = 6;

/** Uniform random integer in [0, n), with no modulo bias. */
function randomIndex(n, rng) {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do { rng.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % n;
}

/** Makes a new phrase: words separated by single spaces. */
export async function generatePhrase(count = PHRASE_WORDS, rng = globalThis.crypto) {
  const { default: list } = await import('./wordlist');
  const words = [];
  for (let i = 0; i < count; i++) words.push(list[randomIndex(list.length, rng)]);
  return words.join(' ');
}

/** The words of a phrase, tolerant of case and of spaces, commas, hyphens or new lines between them. */
export function phraseWords(input) {
  return String(input || '')
    .toLowerCase()
    .split(/[\s,\-–—_.]+/)
    .filter(Boolean);
}

/** The form that is fed to the key derivation: lower case, single spaces. The same phrase always gives the same string. */
export function normalizePhrase(input) {
  return phraseWords(input).join(' ');
}

/** Two different word positions (0-based, ascending) to ask the person to type back. */
export function confirmationPositions(count = PHRASE_WORDS, rng = globalThis.crypto) {
  const a = randomIndex(count, rng);
  let b = randomIndex(count - 1, rng);
  if (b >= a) b += 1;
  return [a, b].sort((x, y) => x - y);
}

/** True when `answers` (position -> typed text) match the phrase at those positions. */
export function confirmationMatches(phrase, answers) {
  const words = phraseWords(phrase);
  const positions = Object.keys(answers);
  return positions.length > 0 && positions.every((p) => (answers[p] || '').trim().toLowerCase() === words[Number(p)]);
}

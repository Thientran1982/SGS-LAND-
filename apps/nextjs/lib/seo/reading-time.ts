// Average reading speed for Vietnamese adult readers: 200 words/min
const WORDS_PER_MINUTE = 200;

/** Returns estimated reading time in minutes, minimum 1. */
export function calculateReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

// SMS messages are limited to 160 characters per segment (GSM-7).
export const MAX_SEGMENT_CHARS = 160;

// Returns the minimum number of SMS segments needed to deliver `message`
// without splitting any word across segments. Used to report how many
// billable SMS parts a notification will consume.
export function minSmsSegments(message: string): number {
  if (!message || !message.trim()) return 0;
  const words = message.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 0;
  return minSegmentsFrom(words, 0);
}

function minSegmentsFrom(words: string[], start: number): number {
  if (start >= words.length) return 0;
  let best = Infinity;
  let currentLen = 0;
  for (let end = start; end < words.length; end++) {
    const add = currentLen === 0 ? words[end].length : words[end].length + 1;
    if (currentLen + add > MAX_SEGMENT_CHARS) break;
    currentLen += add;
    const rest = minSegmentsFrom(words, end + 1);
    if (rest + 1 < best) best = rest + 1;
  }
  return best === Infinity ? 0 : best;
}

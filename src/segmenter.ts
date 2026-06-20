// SMS messages are limited to 160 characters per segment (GSM-7).
export const MAX_SEGMENT_CHARS = 160;

// Returns the minimum number of SMS segments needed to deliver `message`
// without splitting any word across segments. Used to report how many
// billable SMS parts a notification will consume.
//
// Greedy first-fit packing is optimal for partitioning an in-order word
// sequence into the fewest fixed-size segments, so this is O(n) — not the
// previous exponential recursive search. A word longer than the limit can't
// share a segment, so it occupies its own (counted as 1, never reported as 0).
export function minSmsSegments(message: string): number {
  const words = message.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 0;

  let segments = 1;
  let currentLen = 0; // characters used in the current segment

  for (const word of words) {
    if (currentLen === 0) {
      // First word of a segment. An over-long word still sits here alone and,
      // because currentLen then exceeds the limit, pushes the next to a new one.
      currentLen = word.length;
    } else if (currentLen + 1 + word.length <= MAX_SEGMENT_CHARS) {
      currentLen += 1 + word.length; // +1 for the joining space
    } else {
      segments++;
      currentLen = word.length;
    }
  }

  return segments;
}

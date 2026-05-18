namespace NotificationApi;

public static class SmsSegmenter
{
    // SMS messages are limited to 160 characters per segment (GSM-7).
    public const int MaxSegmentChars = 160;

    // Returns the minimum number of SMS segments needed to deliver `message`
    // without splitting any word across segments. Used to report how many
    // billable SMS parts a notification will consume.
    public static int MinSegments(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return 0;

        var words = message.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length == 0) return 0;

        int segmentsCount = 1;
        int currentSegmentLength = 0;

        foreach (var word in words)
        {
            int wordLength = word.Length;

            // If a single word exceeds the maximum character limit, it cannot fit 
            // into any segment without breaking the "no split" constraint.
            if (wordLength > MaxSegmentChars)
            {
                return 0;
            }

            // A space must be added between words, unless it's the first word in the current segment
            int lengthToAdd = (currentSegmentLength == 0) ? wordLength : wordLength + 1;

            // Check if the word fits into the current SMS segment
            if (currentSegmentLength + lengthToAdd <= MaxSegmentChars)
            {
                currentSegmentLength += lengthToAdd;
            }
            else
            {
                // Move the word to a brand new segment
                segmentsCount++;
                currentSegmentLength = wordLength;
            }
        }

        return segmentsCount;
    }
}

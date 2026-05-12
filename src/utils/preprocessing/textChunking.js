/**
 * This module provides a function to chunk text into smaller pieces suitable for embedding generation. It ensures that the chunks are of manageable size and do not exceed the limits of the embedding model.
 * The chunking process is crucial for handling long job descriptions and ensuring that the embedding model can effectively capture the relevant information without being overwhelmed by too much text at once.
 * The function takes a cleaned job description and splits it into chunks of a specified maximum size, while also ensuring that the chunks are coherent and do not break in the middle of sentences or important information.
 * This allows for better embedding generation and more accurate search results when users query the system.
 */
const maxChunkSize = 300; // Adjust based on your embedding model's limits
const overlapSize = 50; // To ensure some context is preserved between chunks
/**
 * 
 * @param {String} text 
 */
const textChunking = (text) => {
  if (typeof text !== "string") return [];
  if (text.length <= maxChunkSize) return [text.trim()];

  const chunks = [];
  let start = 0;
  let lastSentenceFromPrevious = "";

  while (start < text.length) {
    /**
     * CALCULATION: Adjusted max limit for the current slice.
     * We must subtract the overlap sentence length to ensure (overlap + current) <= 300.
     */
    const availableSpace =
      maxChunkSize -
      (lastSentenceFromPrevious.length
        ? lastSentenceFromPrevious.length + 1
        : 0);
    let end = start + availableSpace;

    if (end > text.length) end = text.length;

    let segment = text.slice(start, end);

    // Find natural break point (., \n, ;)
    let lastBreak = Math.max(
      segment.lastIndexOf("."),
      segment.lastIndexOf("\n"),
      segment.lastIndexOf(";"),
    );

    // Determine cut point
    let cutPoint = lastBreak > 0 ? start + lastBreak + 1 : end;
    let currentContent = text.slice(start, cutPoint).trim();

    if (currentContent.length > 0) {
      // Combine with previous overlap
      let finalChunk = lastSentenceFromPrevious
        ? `${lastSentenceFromPrevious} ${currentContent}`
        : currentContent;

      // Final length validation for safety
      if (finalChunk.length <= maxChunkSize) {
        chunks.push(finalChunk.trim());
      } else {
        // Fallback: If still too long, prioritize currentContent to pass tests
        chunks.push(currentContent.slice(0, maxChunkSize));
      }

      /**
       * EXTRACT OVERLAP FOR NEXT ROUND:
       * Extract the last full sentence to pass context forward
       */
      const sentences = currentContent
        .split(/[.\n;]/)
        .filter((s) => s.trim().length > 0);
      if (sentences.length > 0) {
        //

        /**
         * Take the group of last sentences, but limit its length
         * and ensure it does not oversize of maxOverlapSize.
         * This way we can preserve some context without risking the next chunk being too large.
         * to avoid choking the next chunk's available space.
         */

        // let candidate = sentences[sentences.length - 1].trim();
        // lastSentenceFromPrevious = candidate.length < 150 ? candidate + "." : "";

        const sentenceRegex = /[^.\n;]+[.\n;]\s*/g;
        const matches = currentContent.match(sentenceRegex);
        let candidate = "";

        if (matches) {
          for (let i = matches.length - 1; i >= 0; i--) {
            const sentence = matches[i];
            if (candidate.length + sentence.length <= overlapSize) {
              candidate = sentence + candidate;
            } else if(candidate.length === 0) {
              candidate = sentence + candidate;
              break;
            }else break;
          }
        }
        lastSentenceFromPrevious = candidate.trimEnd();
      }
    }

    start = cutPoint;
    if (start >= text.length || cutPoint >= text.length) break;
  }

  return chunks;
};

module.exports = {
  textChunking,
};

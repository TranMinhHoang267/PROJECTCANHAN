/**
 * This module provides a function to chunk text into smaller pieces suitable for embedding generation. It ensures that the chunks are of manageable size and do not exceed the limits of the embedding model.
 * The chunking process is crucial for handling long job descriptions and ensuring that the embedding model can effectively capture the relevant information without being overwhelmed by too much text at once.
 * The function takes a cleaned job description and splits it into chunks of a specified maximum size, while also ensuring that the chunks are coherent and do not break in the middle of sentences or important information.
 * This allows for better embedding generation and more accurate search results when users query the system.
 */
const maxChunkSize = 150; // Adjust based on your embedding model's limits
/**
 *
 * @param {String} text
 * @returns {Array<String>}
 */
const textChunking = (text) => {
  if (typeof text !== "string") return [];
  if (text.length <= maxChunkSize) return [text.trim()];

  const chunks = [];
  let start = 0;
  let lastSentenceFromPrevious;

  while (start < text.length) {
    // Calculate end index for the current chunk
    let end = start + maxChunkSize;

    if (end > text.length) end = text.length;

    let segment = text.slice(start, end);

    // Find natural break point (., \n, ;)
    let lastBreak = Math.max(
      segment.lastIndexOf("."),
      segment.lastIndexOf("\n"),
      segment.lastIndexOf(";"),
    );

    // Determine cut point
    let cutPoint;
    if (lastBreak > 0) {
      cutPoint = start + lastBreak; // Cut at natural break
    } else if (end < text.length) {
      let lastSpace = segment.lastIndexOf(" ");
      if (lastSpace > 0) {
        cutPoint = start + lastSpace;
      } else {
        cutPoint = end; // No natural break, cut at max limit
      }
    } else {
      cutPoint = end; // End of text
    }

    if (cutPoint <= start) cutPoint = end; // Safety check to avoid infinite loop

    let currentContent = text.slice(start, cutPoint).trim();

    if (currentContent.length > 0) {
      // Combine with previous overlap
      let finalChunk = lastSentenceFromPrevious
        ? `${lastSentenceFromPrevious} ${currentContent}`
        : currentContent;

      chunks.push(finalChunk.trim());

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

        if (matches && matches.length > 0) {
          lastSentenceFromPrevious = matches[matches.length - 1].trim();
        } else {
          // If we can't find a proper sentence break, we can take the last few words as context instead
          const words = currentContent.split(" ");
          lastSentenceFromPrevious =
            words.length > 5 ? words.slice(-5).join(" ") : currentContent;
        }
      }
    }

    start = cutPoint;
    if (start >= text.length || cutPoint >= text.length) break;
  }

  return chunks;
};

/**
 *
 * @param {Array<String>} array
 * @returns {Array<String>}
 */
const arrayChunking = (array) => {
  if (!Array.isArray(array)) return [];
  const chunks = [];

  for (const item of array) {
    if (!item) continue;
    const temp = textChunking(item);
    if (temp.length === 0) continue;
    chunks.push(...temp);
  }

  return chunks;
};

module.exports = {
  textChunking,
  arrayChunking,
};

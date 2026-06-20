import { createLogger } from "../../utils/logger";
import type { NormalizedStoryScript, StoryTextChunk, StoryCardOptions } from "./types";

const log = createLogger("story-card:chunker");

/** Splits text into individual sentences using punctuation boundaries. */
function splitIntoSentences(text: string): string[] {
  const sentenceRegex = /[^.!?]+[.!?]+["')\]]*|.+$/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = sentenceRegex.exec(text)) !== null) {matches.push(match[0].trim());}
  return matches.length > 0 ? matches : [text.trim()];
}

/** Tokenizes text into words, filtering empty strings. */
function tokenizeWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** Estimates how many lines a block of text will occupy given a max chars per line. */
function estimateLineCount(text: string, maxCharsPerLine: number): number {
  return Math.ceil(text.length / maxCharsPerLine);
}

/** Generates a zero-padded chunk ID string. */
function generateChunkId(index: number): string {
  return `card_${String(index).padStart(3, "0")}`;
}

/** Splits a long sentence into smaller parts respecting word and line limits. */
function splitLongSentence(sentence: string, maxWords: number, maxCharsPerLine: number, maxLines: number): string[] {
  const words = tokenizeWords(sentence);
  const maxChars = maxCharsPerLine * maxLines;
  if (words.length <= maxWords && sentence.length <= maxChars) {return [sentence];}

  const parts: string[] = [];
  let currentPart: string[] = [];
  let currentCharCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordWithSpace = currentPart.length > 0 ? ` ${word}` : word;
    if (currentPart.length >= maxWords || currentCharCount + wordWithSpace.length > maxChars) {
      if (currentPart.length > 0) { parts.push(currentPart.join(" ")); currentPart = [word]; currentCharCount = word.length; }
      else { parts.push(word); currentPart = []; currentCharCount = 0; }
    } else { currentPart.push(word); currentCharCount += wordWithSpace.length; }
  }
  if (currentPart.length > 0) {parts.push(currentPart.join(" "));}
  return parts;
}

/** Merges the last two chunks if the final chunk is too short. */
function rebalanceChunks(chunks: StoryTextChunk[], minWords: number, maxWords: number): StoryTextChunk[] {
  if (chunks.length === 0) {return chunks;}
  const lastChunk = chunks[chunks.length - 1];
  if (lastChunk.words.length < minWords && chunks.length > 1) {
    const prevChunk = chunks[chunks.length - 2];
    const mergedWords = [...prevChunk.words, ...lastChunk.words];
    if (mergedWords.length <= maxWords) {
      prevChunk.text = mergedWords.join(" ");
      prevChunk.words = mergedWords;
      prevChunk.wordEndIndex = lastChunk.wordEndIndex;
      prevChunk.charCount = prevChunk.text.length;
      prevChunk.lineEstimate = Math.max(prevChunk.lineEstimate, lastChunk.lineEstimate);
      chunks.pop();
    }
  }
  return chunks;
}

/**
 * Splits a normalized story script into display chunks for individual cards.
 */
export function chunkStoryText(normalized: NormalizedStoryScript, options: StoryCardOptions): StoryTextChunk[] {
  const maxWords = options.wordsPerCard ?? 24;
  const maxLines = options.maxLinesPerCard ?? 3;
  const maxCharsPerLine = options.maxCharsPerLine ?? 42;
  const sentences = splitIntoSentences(normalized.body);
  const chunks: StoryTextChunk[] = [];
  let currentWords: string[] = [];
  let currentText = "";
  let wordIndex = 0;

  const flushChunk = () => {
    if (currentWords.length === 0) {return;}
    const text = currentText.trim();
    const words = tokenizeWords(text);
    chunks.push({ id: generateChunkId(chunks.length), index: chunks.length, text, words, wordStartIndex: wordIndex, wordEndIndex: wordIndex + words.length - 1, charCount: text.length, lineEstimate: estimateLineCount(text, maxCharsPerLine), isTitleCard: false, isOutroCard: false });
    wordIndex += words.length;
    currentWords = [];
    currentText = "";
  };

  for (const sentence of sentences) {
    const sentenceWords = tokenizeWords(sentence);
    const sentenceCharCount = sentence.length;

    if (sentenceWords.length > maxWords || sentenceCharCount > maxCharsPerLine * maxLines) {
      flushChunk();
      for (const part of splitLongSentence(sentence, maxWords, maxCharsPerLine, maxLines)) {
        const partWords = tokenizeWords(part);
        chunks.push({ id: generateChunkId(chunks.length), index: chunks.length, text: part, words: partWords, wordStartIndex: wordIndex, wordEndIndex: wordIndex + partWords.length - 1, charCount: part.length, lineEstimate: estimateLineCount(part, maxCharsPerLine), isTitleCard: false, isOutroCard: false });
        wordIndex += partWords.length;
      }
      continue;
    }

    const combinedWords = currentWords.length + sentenceWords.length;
    const combinedText = currentText ? `${currentText} ${sentence}` : sentence;
    const combinedLineEstimate = estimateLineCount(combinedText, maxCharsPerLine);

    if (combinedWords > maxWords || combinedLineEstimate > maxLines) {
      flushChunk();
      currentWords = sentenceWords;
      currentText = sentence;
    } else {
      currentWords = tokenizeWords(combinedText);
      currentText = combinedText;
    }
  }
  flushChunk();

  const rebalanced = rebalanceChunks(chunks, Math.max(8, maxWords / 3), maxWords);
  const finalChunks: StoryTextChunk[] = [];

  if (normalized.title) {
    const titleWords = tokenizeWords(normalized.title);
    finalChunks.push({ id: generateChunkId(0), index: 0, text: normalized.title, words: titleWords, wordStartIndex: 0, wordEndIndex: titleWords.length - 1, charCount: normalized.title.length, lineEstimate: estimateLineCount(normalized.title, maxCharsPerLine), isTitleCard: true, isOutroCard: false });
    for (const chunk of rebalanced) {
      chunk.index += 1;
      chunk.id = generateChunkId(chunk.index);
      chunk.wordStartIndex += titleWords.length;
      chunk.wordEndIndex += titleWords.length;
    }
  }
  finalChunks.push(...rebalanced);

  log.info(`Created ${finalChunks.length} chunks from ${normalized.wordCount} words`);
  return finalChunks;
}

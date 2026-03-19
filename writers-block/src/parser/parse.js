#!/usr/bin/env node

/**
 * Phase 0 parser starter.
 *
 * Responsibilities (current):
 * - Read a Gutenberg plain text file for a single book.
 * - Trim to the content between gutenbergStart and gutenbergEnd markers.
 * - Split into rough "words" (tokens) and map to the Word object skeleton.
 * - Emit JSON for words and an empty lexicon to be filled by later passes.
 *
 * Non-goals (for now):
 * - Accurate phrase detection / lexicon building.
 * - Final chapter/paragraph boundary detection.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");
const { getBookConfig } = require("../config/bookConfigs");
const { defaultGameConfig } = require("../config/gameConfig");

/**
 * @typedef {Object} Word
 * @property {number} index
 * @property {string} raw
 * @property {string} canonical
 * @property {string} firstLetter
 * @property {number} length
 * @property {boolean} locked
 * @property {string[]} attempts
 * @property {boolean} hasContraction
 * @property {boolean} hasHyphen
 * @property {number} chapterIndex
 * @property {number} paragraphIndex
 * @property {null | 'paragraph' | 'section' | 'chapter' | 'part'} boundaryBefore
 * @property {number[]} sectionPath
 */

/**
 * @typedef {Object} LexiconEntry
 * @property {string} id
 * @property {string} canonical
 * @property {string} raw
 * @property {number[]} indices
 * @property {boolean} isPhrase
 * @property {number} count
 * @property {number} lockedCount
 * @property {number | null} discoveredAt
 */

function loadRawText(inputPath, bookConfig) {
  const raw = fs.readFileSync(inputPath, "utf8");
  const startIdx = raw.indexOf(bookConfig.gutenbergStart);
  const endIdx = raw.indexOf(bookConfig.gutenbergEnd);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return raw;
  }

  // Slice between markers; this is deliberately rough.
  const sliced = raw.slice(startIdx + bookConfig.gutenbergStart.length, endIdx);
  return sliced;
}

function normalizeToken(token) {
  const canonical = token.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "");
  const firstLetter = canonical[0] || "";
  const hasContraction = defaultGameConfig.contractionsAsOneWord && canonical.includes("'");
  const hasHyphen = defaultGameConfig.hyphensAsOneWord && canonical.includes("-");

  return {
    canonical,
    firstLetter,
    hasContraction,
    hasHyphen,
  };
}

/**
 * Rough tokenizer: split on whitespace, keep punctuation in raw form.
 * Paragraphs are detected via blank lines for now.
 */
function parseToWords(rawText) {
  /** @type {Word[]} */
  const words = [];
  let index = 0;
  let chapterIndex = 0;
  let paragraphIndex = 0;

  const lines = rawText.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      // New paragraph boundary.
      paragraphIndex += 1;
      continue;
    }

    const tokens = line.split(/\s+/);
    for (const token of tokens) {
      if (!token) continue;

      const { canonical, firstLetter, hasContraction, hasHyphen } = normalizeToken(token);
      if (!canonical) continue;

      /** @type {Word} */
      const word = {
        index,
        raw: token,
        canonical,
        firstLetter,
        length: canonical.length,
        locked: false,
        attempts: [],
        hasContraction,
        hasHyphen,
        chapterIndex,
        paragraphIndex,
        boundaryBefore: null,
        sectionPath: [],
      };

      words.push(word);
      index += 1;
    }
  }

  return words;
}

/**
 * Starter lexicon builder: just counts canonical single words.
 */
function buildLexicon(words) {
  /** @type {Map<string, LexiconEntry>} */
  const map = new Map();

  for (const word of words) {
    const key = word.canonical;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.indices.push(word.index);
    } else {
      map.set(key, {
        id: `lex_${map.size.toString().padStart(4, "0")}`,
        canonical: word.canonical,
        raw: word.raw,
        indices: [word.index],
        isPhrase: false,
        count: 1,
        lockedCount: 0,
        discoveredAt: null,
      });
    }
  }

  return Array.from(map.values());
}

function parseArgs(argv) {
  const args = {
    bookId: null,
    inputPath: null,
    outputDir: null,
  };

  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--bookId" || a === "--book" || a === "-b") {
      args.bookId = argv[i + 1] || null;
      i += 1;
      continue;
    }
    positionals.push(a);
  }

  args.inputPath = positionals[0] || null;
  args.outputDir = positionals[1] || null;
  return args;
}

function inferBookId({ bookId, inputPath, outputDir }) {
  if (bookId) return bookId;
  if (outputDir) return path.basename(outputDir);
  if (inputPath) return path.basename(inputPath).replace(/\.txt$/i, "");
  return null;
}

function main() {
  const { bookId, inputPath, outputDir } = parseArgs(process.argv.slice(2));
  if (!inputPath || !outputDir) {
    console.error(
      "Usage: node src/parser/parse.js [--bookId <book-id>] <input.txt> <outputDir>"
    );
    process.exit(1);
  }

  const resolvedBookId = inferBookId({ bookId, inputPath, outputDir });
  const bookConfig = getBookConfig(resolvedBookId);

  if (!bookConfig) {
    console.error(`Unknown bookId "${resolvedBookId}".`);
    console.error("Add it to src/config/bookConfigs.js or pass a valid --bookId.");
    process.exit(1);
  }

  const raw = loadRawText(inputPath, bookConfig);
  const words = parseToWords(raw);
  const lexicon = buildLexicon(words);

  const outWordsPath = path.join(outputDir, `${bookConfig.bookId}.words.json`);
  const outLexiconPath = path.join(outputDir, `${bookConfig.bookId}.lexicon.json`);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outWordsPath, JSON.stringify(words, null, 2), "utf8");
  fs.writeFileSync(outLexiconPath, JSON.stringify(lexicon, null, 2), "utf8");

  console.log(`Wrote ${words.length} words to ${outWordsPath}`);
  console.log(`Wrote ${lexicon.length} lexicon entries to ${outLexiconPath}`);
}

if (require.main === module) {
  main();
}


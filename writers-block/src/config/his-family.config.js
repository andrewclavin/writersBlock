/** Book config for "His Family" used by the parser and game logic. */

/** @typedef {{ type: 'chapter', marker: RegExp, label: (match: RegExpMatchArray) => string }} StructureItem */

/** @type {{ 
 *  bookId: string;
 *  title: string;
 *  author: string;
 *  local: boolean;
 *  visible: boolean;
 *  aiEnabled: boolean;
 *  gutenbergStart: string;
 *  gutenbergEnd: string;
 *  structure: StructureItem[];
 * }} 
 */
const hisFamilyConfig = {
  bookId: "his-family",
  title: "His Family",
  author: "Ernest Poole",
  local: false,
  visible: true,
  aiEnabled: true,
  gutenbergStart: "*** START OF",
  gutenbergEnd: "*** END OF",
  structure: [
    // Some Gutenberg texts use "CHAPTER" headings; refine as needed per source file.
    {
      type: "chapter",
      marker: /^CHAPTER\s+[IVX]+/m,
      label: (match) => match[0],
    },
  ],
};

module.exports = hisFamilyConfig;


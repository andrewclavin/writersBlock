/** Book config for "The Age of Innocence" used by the parser and game logic. */

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
const ageOfInnocenceConfig = {
  bookId: "age-of-innocence",
  title: "The Age of Innocence",
  author: "Edith Wharton",
  local: false,
  visible: true,
  aiEnabled: true,
  gutenbergStart: "*** START OF",
  gutenbergEnd: "*** END OF",
  structure: [
    {
      type: "chapter",
      marker: /^CHAPTER [IVX]+/m,
      label: (match) => match[0],
    },
  ],
};

module.exports = ageOfInnocenceConfig;


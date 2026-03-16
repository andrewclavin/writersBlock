/** Book config for "The Great Gatsby" used by the parser and game logic. */

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
const gatsbyConfig = {
  bookId: "great-gatsby",
  title: "The Great Gatsby",
  author: "F. Scott Fitzgerald",
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

module.exports = gatsbyConfig;


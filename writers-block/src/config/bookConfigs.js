const gatsbyConfig = require("./gatsby.config.js");
const ageOfInnocenceConfig = require("./age-of-innocence.config.js");
const hisFamilyConfig = require("./his-family.config.js");

/** @type {any[]} */
const allBookConfigs = [
  gatsbyConfig,
  ageOfInnocenceConfig,
  hisFamilyConfig,
];

// Local-only (copyrighted) configs should live only on the developer's machine.
try {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const oldManAndTheSeaConfig = require("./old-man-and-the-sea.config.js");
  allBookConfigs.push(oldManAndTheSeaConfig);
} catch {
  // Intentionally optional.
}

/** @type {Map<string, any>} */
const byId = new Map(allBookConfigs.map((c) => [c.bookId, c]));

function getBookConfig(bookId) {
  if (!bookId) return null;
  return byId.get(bookId) || null;
}

module.exports = { allBookConfigs, getBookConfig };


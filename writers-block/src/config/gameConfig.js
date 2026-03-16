// Plain JS twin of the TS game config for Node scripts.

const defaultGameConfig = {
  minPhraseOccurrences: 3,
  minPhraseLength: 2,
  maxPhraseLength: 6,
  contractionsAsOneWord: true,
  hyphensAsOneWord: true,
  crossParagraphPhrases: false,
  crossChapterPhrases: false,
};

module.exports = { defaultGameConfig };

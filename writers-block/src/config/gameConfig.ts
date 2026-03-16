export type GameConfig = {
  minPhraseOccurrences: number;
  minPhraseLength: number;
  maxPhraseLength: number;
  contractionsAsOneWord: boolean;
  hyphensAsOneWord: boolean;
  crossParagraphPhrases: boolean;
  crossChapterPhrases: boolean;
};

export const defaultGameConfig: GameConfig = {
  minPhraseOccurrences: 3,
  minPhraseLength: 2,
  maxPhraseLength: 6,
  contractionsAsOneWord: true,
  hyphensAsOneWord: true,
  crossParagraphPhrases: false,
  crossChapterPhrases: false,
};


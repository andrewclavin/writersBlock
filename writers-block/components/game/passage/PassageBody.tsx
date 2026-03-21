import { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { GameChrome } from '@/constants/gameChrome';

import { PassageWord } from './PassageWord';

type PhraseSpan = { start: number; length: number };

type PassageSegment =
  | { kind: 'single'; index: number }
  | { kind: 'phrase'; start: number; length: number };

function buildPassageSegments(wordCount: number, span: PhraseSpan | null): PassageSegment[] {
  const out: PassageSegment[] = [];
  let i = 0;
  while (i < wordCount) {
    if (span && i === span.start && span.length > 1) {
      out.push({ kind: 'phrase', start: span.start, length: span.length });
      i += span.length;
    } else {
      out.push({ kind: 'single', index: i });
      i++;
    }
  }
  return out;
}

type PassageBodyProps = {
  words: string[];
  placedWords: Set<number>;
  selectedSlotIndex: number;
  /** Multi-slot highlight when filling a lexicon-linked phrase. */
  activePhraseSpan?: PhraseSpan | null;
  onSelectSlot: (index: number) => void;
  bottomInset: number;
  /** Passage layout measurement for cascade flights (slot index → view). */
  onSlotAnchorRef?: (slotIndex: number, node: View | null) => void;
  cascadePreviewSlots?: ReadonlySet<number> | null;
};

export function PassageBody({
  words,
  placedWords,
  selectedSlotIndex,
  activePhraseSpan = null,
  onSelectSlot,
  bottomInset,
  onSlotAnchorRef,
  cascadePreviewSlots = null,
}: PassageBodyProps) {
  const { width } = useWindowDimensions();
  const padH =
    width >= 1280 ? 128 : width >= 1024 ? 96 : width >= 768 ? 64 : width >= 640 ? 48 : 32;
  const padV = width >= 768 ? 96 : width >= 640 ? 80 : 64;

  const segments = useMemo(
    () => buildPassageSegments(words.length, activePhraseSpan),
    [activePhraseSpan, words.length]
  );

  const phraseGroupRing = useMemo(() => {
    if (!activePhraseSpan || activePhraseSpan.length < 2) return false;
    const { start, length } = activePhraseSpan;
    if (placedWords.has(selectedSlotIndex)) return false;
    return selectedSlotIndex >= start && selectedSlotIndex < start + length;
  }, [activePhraseSpan, placedWords, selectedSlotIndex]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: padH, paddingTop: padV, paddingBottom: bottomInset },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.inner}>
        <View style={styles.flow}>
          {segments.map((seg) => {
            if (seg.kind === 'single') {
              const index = seg.index;
              const word = words[index] ?? '\u00A0';
              const isPlaced = placedWords.has(index);
              return (
                <PassageWord
                  key={`${index}-${word}`}
                  word={word}
                  slotIndex={index}
                  isPlaced={isPlaced}
                  isSelected={index === selectedSlotIndex}
                  onSlotAnchorRef={onSlotAnchorRef}
                  cascadePreview={!!cascadePreviewSlots?.has(index)}
                  onSelectSlot={onSelectSlot}
                />
              );
            }

            const cells = Array.from({ length: seg.length }, (_, k) => {
              const index = seg.start + k;
              const word = words[index] ?? '\u00A0';
              const isPlaced = placedWords.has(index);
              return (
                <PassageWord
                  key={`${index}-${word}`}
                  word={word}
                  slotIndex={index}
                  isPlaced={isPlaced}
                  isSelected={index === selectedSlotIndex}
                  suppressActiveRing={phraseGroupRing}
                  onSlotAnchorRef={onSlotAnchorRef}
                  cascadePreview={!!cascadePreviewSlots?.has(index)}
                  onSelectSlot={onSelectSlot}
                />
              );
            });

            return (
              <View
                key={`phrase-${seg.start}`}
                style={[styles.phraseGroup, phraseGroupRing && styles.phraseGroupRing]}>
                {cells}
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  inner: {
    maxWidth: 1024,
    width: '100%',
    alignSelf: 'center',
  },
  flow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  phraseGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    marginRight: 6,
  },
  phraseGroupRing: {
    padding: 2,
    marginRight: 4,
    marginVertical: 1,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: GameChrome.activeRing,
    backgroundColor: GameChrome.ringOffsetBackground,
  },
});

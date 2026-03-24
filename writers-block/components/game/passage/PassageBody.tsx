import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  computePillFrame,
  passageFocusPhraseRingStyle,
} from '@/constants/passageFocusChrome';

import { PassageWord } from './PassageWord';

type PhraseSpan = { start: number; length: number };

type PassageSegment =
  | { kind: 'single'; index: number }
  | { kind: 'phrase'; start: number; length: number }
  | { kind: 'paragraphBreak' };

function buildPassageSegments(
  wordCount: number,
  span: PhraseSpan | null,
  paragraphBreaks?: ReadonlySet<number>
): PassageSegment[] {
  const out: PassageSegment[] = [];
  let i = 0;
  while (i < wordCount) {
    if (paragraphBreaks?.has(i)) {
      out.push({ kind: 'paragraphBreak' });
    }
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
  activePhraseSpan?: PhraseSpan | null;
  paragraphBreakIndices?: ReadonlySet<number>;
  onSelectSlot: (index: number) => void;
  bottomInset: number;
  onSlotAnchorRef?: (slotIndex: number, node: View | null) => void;
  cascadePreviewSlots?: ReadonlySet<number> | null;
  /** Keyboard cascade: per-slot count of leading graphemes to show while animating. */
  cascadeRevealBySlot?: ReadonlyMap<number, number> | null;
};

export function PassageBody({
  words,
  placedWords,
  selectedSlotIndex,
  activePhraseSpan = null,
  paragraphBreakIndices,
  onSelectSlot,
  bottomInset,
  onSlotAnchorRef,
  cascadePreviewSlots = null,
  cascadeRevealBySlot = null,
}: PassageBodyProps) {
  const { width } = useWindowDimensions();
  const padH =
    width >= 1280 ? 128 : width >= 1024 ? 96 : width >= 768 ? 64 : width >= 640 ? 48 : 32;
  const padV = width >= 768 ? 96 : width >= 640 ? 80 : 64;
  const fontSize = width >= 768 ? 18 : width >= 640 ? 17 : 16;
  const lineHeight = Math.round(fontSize * 1.65);
  const indentWidth = fontSize * 1.8;

  const pill = useMemo(() => computePillFrame(fontSize, lineHeight), [fontSize, lineHeight]);
  const phraseRingStyle = useMemo(
    () => passageFocusPhraseRingStyle(pill, lineHeight),
    [pill, lineHeight]
  );

  const segments = useMemo(
    () => buildPassageSegments(words.length, activePhraseSpan, paragraphBreakIndices),
    [activePhraseSpan, paragraphBreakIndices, words.length]
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
          {segments.map((seg, segIdx) => {
            if (seg.kind === 'paragraphBreak') {
              return (
                <React.Fragment key={`pbreak-${segIdx}`}>
                  <View style={styles.paragraphBreak} />
                  <View style={{ width: indentWidth }} />
                </React.Fragment>
              );
            }

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
                  showFocusRing={index === selectedSlotIndex}
                  cascadeRevealCharCount={cascadeRevealBySlot?.get(index)}
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
                  showFocusRing={phraseGroupRing || index === selectedSlotIndex}
                  cascadeRevealCharCount={cascadeRevealBySlot?.get(index)}
                  onSlotAnchorRef={onSlotAnchorRef}
                  cascadePreview={!!cascadePreviewSlots?.has(index)}
                  onSelectSlot={onSelectSlot}
                />
              );
            });

            return (
              <View key={`phrase-${seg.start}`} style={styles.phraseGroup}>
                {cells}
                {phraseGroupRing ? (
                  <View pointerEvents="none" style={phraseRingStyle} />
                ) : null}
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
    columnGap: 6,
  },
  paragraphBreak: {
    width: '100%',
    height: 0,
    overflow: 'hidden',
  },
  phraseGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 6,
    position: 'relative',
    overflow: 'visible',
  },
});

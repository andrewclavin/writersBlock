import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaySessionMenu } from '@/components/game/PlaySessionMenu';
import { GameKeyboard } from '@/components/game/keyboard/GameKeyboard';
import { LexiconDrawer } from '@/components/game/lexicon/LexiconDrawer';
import { PassageBody } from '@/components/game/passage/PassageBody';
import { SessionProgressFooter } from '@/components/game/SessionProgressFooter';
import { usePlayFromParsedWords } from '@/components/game/usePlayFromParsedWords';
import type { ParsedBookWord } from '@/src/data/bookTypes';
import { TINY_FIXTURE_BOOK_ID, useGetBookBundleQuery } from '@/src/state/api/bookApi';
import { useWebGameKeyboard } from '@/hooks/useWebGameKeyboard';

/** Bottom safe area + progress footer chrome (lift + thinner bar + padding). Tab bar is hidden on Play. */
const FOOTER_CHROME = 100;
/** Approximate height of QWERTY block above the footer. */
/** Taller keys on large breakpoints (wireframe sm:h-14). */
const KEYBOARD_BLOCK = 220;
/** Bottom padding for passage when lexicon is open and keyboard is hidden. */
const PASSAGE_BOTTOM_LEXICON_ONLY = 24;

export default function PlayScreen() {
  const q = useGetBookBundleQuery(TINY_FIXTURE_BOOK_ID);

  if (q.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (q.isError || !q.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load book bundle.</Text>
        {'error' in q && q.error && typeof q.error === 'object' && 'error' in q.error ? (
          <Text style={styles.errorDetail}>{String((q.error as { error: string }).error)}</Text>
        ) : null}
      </View>
    );
  }

  return <PlayLoaded bookId={TINY_FIXTURE_BOOK_ID} words={q.data.words} />;
}

function PlayLoaded({ bookId, words }: { bookId: string; words: ParsedBookWord[] }) {
  const insets = useSafeAreaInsets();
  const bottomSafe = insets.bottom;
  const [lexiconDrawerOpen, setLexiconDrawerOpen] = useState(false);
  const session = usePlayFromParsedWords(words, bookId);
  const passageBottom =
    bottomSafe + FOOTER_CHROME + (lexiconDrawerOpen ? PASSAGE_BOTTOM_LEXICON_ONLY : KEYBOARD_BLOCK);

  const { highlight, clearHighlight, setHighlightFromLetterFocus } = useWebGameKeyboard({
    nextWordsByLetter: session.nextWordsByLetter,
    onWordSelect: session.handleWordSelect,
    selectedSlotIndex: session.selectedSlotIndex,
  });

  useEffect(() => {
    if (lexiconDrawerOpen && Platform.OS === 'web') clearHighlight();
  }, [lexiconDrawerOpen, clearHighlight]);

  const onSelectPassageSlot = useCallback(
    (index: number) => {
      clearHighlight();
      session.selectSlot(index);
    },
    [clearHighlight, session.selectSlot]
  );

  return (
    <View style={styles.root}>
      <PassageBody
        words={session.words}
        placedWords={session.passagePlacedWords}
        selectedSlotIndex={session.selectedSlotIndex}
        activePhraseSpan={session.activePhraseSpan}
        paragraphBreakIndices={session.paragraphBreakIndices}
        onSlotAnchorRef={session.registerSlotCascadeAnchor}
        cascadePillAttractBySlot={session.cascadePillAttractBySlot}
        cascadeGreySquashBySlot={session.cascadeGreySquashBySlot}
        cascadeRevealBySlot={session.cascadeRevealBySlot}
        onSelectSlot={onSelectPassageSlot}
        bottomInset={passageBottom}
      />
      <LexiconDrawer
        wordEntries={session.lexiconWordEntries}
        phraseEntries={session.lexiconPhraseEntries}
        onLexiconMergeKeys={session.tryMergeLexiconKeys}
        onDrawerOpenChange={setLexiconDrawerOpen}
        registerCascadeAnchor={session.registerLexiconCascadeAnchor}
        cascadeHideCharByKey={session.cascadeLexiconHide}
        cascadeGlowByKey={session.cascadeLexiconGlow}
      />
      <GameKeyboard
        visible={!lexiconDrawerOpen}
        nextWordsByLetter={session.nextWordsByLetter}
        onWordSelect={session.handleWordSelect}
        bottomOffset={bottomSafe + FOOTER_CHROME}
        highlightedWordIndex={Platform.OS === 'web' ? (highlight?.wordIndex ?? null) : null}
        highlightedCandidateWord={Platform.OS === 'web' ? (highlight?.word ?? null) : null}
        onLetterFocusHighlight={Platform.OS === 'web' ? setHighlightFromLetterFocus : undefined}
        onClearLetterHighlight={Platform.OS === 'web' ? clearHighlight : undefined}
        cascadeLetterHides={session.cascadeLetterHides}
        cascadeLetterGlow={session.cascadeLetterGlow}
        registerLetterCascadeAnchor={session.registerLetterCascadeAnchor}
      />
      <SessionProgressFooter
        bookTitle="Tiny fixture"
        progress={session.progress}
        totalWords={session.totalActualWords}
        placedWords={session.placedActualWords}
        currentPosition={session.selectedSlotIndex}
        bottomOffset={bottomSafe}
      />
      <PlaySessionMenu
        onClearProgress={session.handleReset}
        canDevUndo={session.canDevUndo}
        canDevRedo={session.canDevRedo}
        onDevUndo={session.devUndo}
        onDevRedo={session.devRedo}
        top={insets.top + 6}
        right={insets.right + 10}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
});

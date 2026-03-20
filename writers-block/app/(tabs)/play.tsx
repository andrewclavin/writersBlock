import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DevPlayClearButton } from '@/components/game/DevPlayClearButton';
import { GameKeyboard } from '@/components/game/keyboard/GameKeyboard';
import { LexiconDrawer } from '@/components/game/lexicon/LexiconDrawer';
import { PassageBody } from '@/components/game/passage/PassageBody';
import { SessionProgressFooter } from '@/components/game/SessionProgressFooter';
import { usePlayFromParsedWords } from '@/components/game/usePlayFromParsedWords';
import type { ParsedBookWord } from '@/src/data/bookTypes';
import { TINY_FIXTURE_BOOK_ID, useGetBookBundleQuery } from '@/src/state/api/bookApi';

/** Tab bar + progress footer chrome (gradient bar + padding). */
const FOOTER_CHROME = 88;
/** Approximate height of QWERTY block above the footer. */
const KEYBOARD_BLOCK = 200;

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
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const session = usePlayFromParsedWords(words, bookId);
  const passageBottom = tabBarHeight + FOOTER_CHROME + KEYBOARD_BLOCK;

  return (
    <View style={styles.root}>
      <PassageBody
        words={session.words}
        placedWords={session.placedWords}
        selectedSlotIndex={session.selectedSlotIndex}
        onSelectSlot={session.selectSlot}
        bottomInset={passageBottom}
      />
      <LexiconDrawer
        wordCounts={session.wordCounts}
        placedWordCounts={session.placedWordCounts}
      />
      <GameKeyboard
        nextWordsByLetter={session.nextWordsByLetter}
        onWordSelect={session.handleWordSelect}
        bottomOffset={tabBarHeight + FOOTER_CHROME}
      />
      <SessionProgressFooter
        bookTitle="Tiny fixture"
        progress={session.progress}
        totalWords={session.totalActualWords}
        placedWords={session.placedActualWords}
        currentPosition={session.selectedSlotIndex}
        bottomOffset={tabBarHeight}
      />
      {/* Last so touches win over full-screen ScrollView; high z-index for stacking. */}
      <DevPlayClearButton
        onClear={session.handleReset}
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

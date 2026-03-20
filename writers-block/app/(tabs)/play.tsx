import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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

  return <PlayLoaded words={q.data.words} />;
}

function PlayLoaded({ words }: { words: ParsedBookWord[] }) {
  const tabBarHeight = useBottomTabBarHeight();
  const session = usePlayFromParsedWords(words);
  const passageBottom = tabBarHeight + FOOTER_CHROME + KEYBOARD_BLOCK;

  return (
    <View style={styles.root}>
      <PassageBody
        words={session.words}
        placedWords={session.placedWords}
        currentPosition={session.currentPosition}
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
        currentPosition={session.currentPosition}
        bottomOffset={tabBarHeight}
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

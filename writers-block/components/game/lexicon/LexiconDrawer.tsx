import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { GameChrome, GameMotion } from '@/constants/gameChrome';

import { LexiconLetterSection } from './LexiconLetterSection';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

type LexiconDrawerProps = {
  wordCounts: Map<string, number>;
  placedWordCounts: Map<string, number>;
  onWordClick?: (word: string) => void;
};

export function LexiconDrawer({ wordCounts, placedWordCounts, onWordClick }: LexiconDrawerProps) {
  const { height, width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.88, 360);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedLetters, setExpandedLetters] = useState<Set<string>>(() => new Set());
  const translateX = useSharedValue(-drawerWidth);
  const drawerW = useSharedValue(drawerWidth);
  const dragStartX = useSharedValue(0);

  useEffect(() => {
    drawerW.value = drawerWidth;
  }, [drawerWidth, drawerW]);

  useEffect(() => {
    if (!isOpen) translateX.value = -drawerWidth;
  }, [isOpen, drawerWidth, translateX]);

  const wordsByLetter = useMemo(() => {
    const map = new Map<string, { word: string; remaining: number }[]>();
    Array.from(wordCounts.entries())
      .map(([word, total]) => ({
        word,
        remaining: total - (placedWordCounts.get(word) || 0),
      }))
      .filter((item) => item.remaining > 0)
      .forEach(({ word, remaining }) => {
        const L = word.charAt(0).toUpperCase();
        if (!map.has(L)) map.set(L, []);
        map.get(L)!.push({ word, remaining });
      });
    return map;
  }, [wordCounts, placedWordCounts]);

  const openDrawer = useCallback(() => {
    translateX.value = withSpring(0, GameMotion.drawerSpring);
    setIsOpen(true);
  }, [translateX]);

  const closeDrawer = useCallback(() => {
    translateX.value = withSpring(-drawerWidth, GameMotion.drawerSpring, (finished) => {
      if (finished) runOnJS(setIsOpen)(false);
    });
  }, [drawerWidth, translateX]);

  const toggleDrawer = useCallback(() => {
    if (isOpen) closeDrawer();
    else openDrawer();
  }, [closeDrawer, isOpen, openDrawer]);

  const toggleLetter = useCallback((letter: string) => {
    setExpandedLetters((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  }, []);

  const pan = Gesture.Pan()
    .enabled(isOpen)
    .activeOffsetX([-16, 16])
    .onStart(() => {
      dragStartX.value = translateX.value;
    })
    .onUpdate((e) => {
      const w = drawerW.value;
      const next = Math.min(0, Math.max(-w, dragStartX.value + e.translationX));
      translateX.value = next;
    })
    .onEnd((e) => {
      const w = drawerW.value;
      if (translateX.value < -w * 0.2 || e.velocityX < -400) {
        translateX.value = withSpring(-w, GameMotion.drawerSpring, (finished) => {
          if (finished) runOnJS(setIsOpen)(false);
        });
      } else {
        translateX.value = withSpring(0, GameMotion.drawerSpring);
      }
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const toggleTop = (height - 88) / 2;

  return (
    <>
      <Pressable
        onPress={toggleDrawer}
        style={[styles.toggle, { top: toggleTop }]}
        accessibilityRole="button"
        accessibilityLabel={isOpen ? 'Close word bank' : 'Open word bank'}>
        <LinearGradient
          colors={[GameChrome.drawerToggleStart, GameChrome.drawerToggleEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.toggleInner}>
          <Ionicons name={isOpen ? 'chevron-back' : 'chevron-forward'} size={22} color="#fff" />
          <Ionicons name="cube-outline" size={18} color="#fff" style={{ marginTop: 4 }} />
        </LinearGradient>
      </Pressable>

      {isOpen && (
        <Pressable style={styles.scrim} onPress={closeDrawer} accessibilityLabel="Close overlay" />
      )}

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.drawer,
            { width: drawerWidth, paddingTop: 48, paddingBottom: 120 },
            panelStyle,
          ]}
          pointerEvents="box-none">
          <View style={styles.drawerInner}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.sections}>
                {LETTERS.map((letter) => (
                  <LexiconLetterSection
                    key={letter}
                    letter={letter}
                    wordsForLetter={wordsByLetter.get(letter) || []}
                    expanded={expandedLetters.has(letter)}
                    onToggleLetter={toggleLetter}
                    onWordPress={(w) => onWordClick?.(w)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  toggle: {
    position: 'absolute',
    left: 0,
    zIndex: 50,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  toggleInner: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 38,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 40,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: GameChrome.drawerBorder,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  drawerInner: {
    flex: 1,
  },
  sections: {
    gap: 12,
    paddingBottom: 24,
  },
});

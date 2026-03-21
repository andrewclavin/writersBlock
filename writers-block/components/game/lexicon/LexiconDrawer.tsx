import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';

import { GameChrome, GameMotion } from '@/constants/gameChrome';

import { LexiconLetterSection, type LexiconDrawerEntry } from './LexiconLetterSection';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Wireframe `calc(24rem - 3rem)` → trailing inset from drawer’s right edge (3rem ≈ 48). */
const DRAWER_TOGGLE_TRAILING_INSET = 48;

const drawerTiming = {
  duration: GameMotion.drawerDurationMs,
  easing: Easing.out(Easing.cubic),
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type LexiconDrawerProps = {
  wordEntries: { word: string; remaining: number }[];
  phraseEntries: { phrase: string; remaining: number }[];
  onLexiconMergeKeys: (fromKey: string, toKey: string) => boolean;
  /** Fires when the drawer finishes opening (visible) or closing (hidden). */
  onDrawerOpenChange?: (open: boolean) => void;
  /** Selection-cascade: measure chip origins for flights from the word bank. */
  registerCascadeAnchor?: (key: string, node: View | null) => void;
  /** Hide chip label during cascade beat (matches `entryKey`). */
  collapseCascadeEntryKey?: string | null;
  cascadePreviewKeys?: ReadonlySet<string> | null;
};

export function LexiconDrawer({
  wordEntries,
  phraseEntries,
  onLexiconMergeKeys,
  onDrawerOpenChange,
  registerCascadeAnchor,
  collapseCascadeEntryKey,
  cascadePreviewKeys,
}: LexiconDrawerProps) {
  const { height, width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.88, 360);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLexiconKey, setSelectedLexiconKey] = useState<string | null>(null);
  const selectedLexiconKeyRef = useRef<string | null>(null);
  const [expandedLetters, setExpandedLetters] = useState<Set<string>>(() => new Set());
  const translateX = useSharedValue(-drawerWidth);
  const drawerW = useSharedValue(drawerWidth);
  const dragStartX = useSharedValue(0);

  useEffect(() => {
    drawerW.value = drawerWidth;
  }, [drawerWidth, drawerW]);

  useEffect(() => {
    if (!isOpen) {
      translateX.value = -drawerWidth;
      selectedLexiconKeyRef.current = null;
      setSelectedLexiconKey(null);
    }
  }, [isOpen, drawerWidth, translateX]);

  const targetsRef = useRef<Map<string, View>>(new Map());

  const registerTarget = useCallback((key: string, node: View | null) => {
    if (node) targetsRef.current.set(key, node);
    else targetsRef.current.delete(key);
  }, []);

  const handleChipDragEnd = useCallback(
    (fromKey: string, absoluteX: number, absoluteY: number) => {
      const entries = [...targetsRef.current.entries()].filter(([k]) => k !== fromKey);
      void Promise.all(
        entries.map(
          ([key, view]) =>
            new Promise<{ key: string; area: number } | null>((resolve) => {
              view.measureInWindow((x, y, w, h) => {
                const hit =
                  absoluteX >= x &&
                  absoluteX <= x + w &&
                  absoluteY >= y &&
                  absoluteY <= y + h;
                resolve(hit ? { key, area: w * h } : null);
              });
            })
        )
      ).then((rects) => {
        const hits = rects.filter((r): r is { key: string; area: number } => r != null);
        if (hits.length === 0) return;
        hits.sort((a, b) => a.area - b.area);
        const ok = onLexiconMergeKeys(fromKey, hits[0]!.key);
        if (ok) {
          selectedLexiconKeyRef.current = null;
          setSelectedLexiconKey(null);
        }
      });
    },
    [onLexiconMergeKeys]
  );

  const onLexiconChipTap = useCallback(
    (key: string) => {
      const prev = selectedLexiconKeyRef.current;
      if (prev == null) {
        selectedLexiconKeyRef.current = key;
        setSelectedLexiconKey(key);
        return;
      }
      if (prev === key) {
        selectedLexiconKeyRef.current = null;
        setSelectedLexiconKey(null);
        return;
      }
      const ok = onLexiconMergeKeys(prev, key);
      const next = ok ? null : key;
      selectedLexiconKeyRef.current = next;
      setSelectedLexiconKey(next);
    },
    [onLexiconMergeKeys]
  );

  const itemsByLetter = useMemo(() => {
    const map = new Map<string, LexiconDrawerEntry[]>();
    const push = (letterRaw: string, item: LexiconDrawerEntry) => {
      const L = letterRaw.toUpperCase();
      if (L < 'A' || L > 'Z') return;
      if (!map.has(L)) map.set(L, []);
      map.get(L)!.push(item);
    };

    wordEntries.forEach(({ word, remaining }) => {
      if (!word) return;
      push(word.charAt(0), {
        entryKey: word,
        display: word,
        remaining,
        isPhrase: false,
      });
    });

    phraseEntries.forEach(({ phrase, remaining }) => {
      const firstWord = phrase.split(/\s+/).find(Boolean) ?? phrase;
      if (!firstWord) return;
      push(firstWord.charAt(0), {
        entryKey: phrase,
        display: phrase,
        remaining,
        isPhrase: true,
      });
    });

    return map;
  }, [wordEntries, phraseEntries]);

  const drawerOpenChangeRef = useRef(onDrawerOpenChange);
  drawerOpenChangeRef.current = onDrawerOpenChange;

  const onDrawerCloseComplete = useCallback(() => {
    setIsOpen(false);
    drawerOpenChangeRef.current?.(false);
  }, []);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
    drawerOpenChangeRef.current?.(true);
    translateX.value = withTiming(0, drawerTiming);
  }, [translateX]);

  const closeDrawer = useCallback(() => {
    translateX.value = withTiming(-drawerWidth, drawerTiming, (finished) => {
      if (finished) runOnJS(onDrawerCloseComplete)();
    });
  }, [drawerWidth, onDrawerCloseComplete, translateX]);

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
        translateX.value = withTiming(-w, drawerTiming, (finished) => {
          if (finished) runOnJS(onDrawerCloseComplete)();
        });
      } else {
        translateX.value = withTiming(0, drawerTiming);
      }
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  /** Same `translateX` as the panel so the toggle stays on the drawer’s trailing edge (wireframe `left` transition). */
  const toggleAnimatedStyle = useAnimatedStyle(() => {
    const w = drawerW.value;
    const x = translateX.value;
    return {
      left: Math.max(0, x + w - DRAWER_TOGGLE_TRAILING_INSET),
      opacity: interpolate(x, [-w, 0], [1, 0.3], Extrapolate.CLAMP),
    };
  });

  const toggleTop = (height - 88) / 2;

  return (
    <>
      <AnimatedPressable
        onPress={toggleDrawer}
        style={[styles.toggle, { top: toggleTop }, toggleAnimatedStyle]}
        accessibilityRole="button"
        accessibilityLabel={isOpen ? 'Close word bank' : 'Open word bank'}>
        <View style={styles.toggleInner}>
          <View style={[styles.blobCol, isOpen && styles.blobColOpen]}>
            <View style={[styles.blob, { width: 24 }]} />
            <View style={[styles.blob, { width: 20 }]} />
            <View style={[styles.blob, { width: 28 }]} />
            <View style={[styles.blob, { width: 16 }]} />
          </View>
          <Ionicons
            name={isOpen ? 'chevron-back' : 'chevron-forward'}
            size={20}
            color="#4B5563"
            style={styles.toggleChevron}
          />
        </View>
      </AnimatedPressable>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              paddingTop: 48,
              paddingBottom: 120,
            },
            panelStyle,
          ]}
          pointerEvents="box-none">
          <BlurView
            intensity={GameChrome.drawerBlurIntensity}
            tint="light"
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: GameChrome.drawerFrostOverlay }]}
          />
          <View style={styles.drawerInner}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.sections}>
                {LETTERS.map((letter) => (
                  <LexiconLetterSection
                    key={letter}
                    letter={letter}
                    itemsForLetter={itemsByLetter.get(letter) || []}
                    expanded={expandedLetters.has(letter)}
                    onToggleLetter={toggleLetter}
                    selectedLexiconKey={selectedLexiconKey}
                    onLexiconChipTap={onLexiconChipTap}
                    registerTarget={registerTarget}
                    onDragEnd={handleChipDragEnd}
                    registerCascadeAnchor={registerCascadeAnchor}
                    collapseCascadeEntryKey={collapseCascadeEntryKey}
                    cascadePreviewKeys={cascadePreviewKeys}
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
    zIndex: 50,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 10,
  },
  toggleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  blobCol: {
    gap: 2,
    alignItems: 'flex-start',
  },
  blobColOpen: {
    alignItems: 'flex-end',
  },
  blob: {
    height: 10,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: GameChrome.drawerToggleBlobBorder,
  },
  toggleChevron: {
    marginLeft: 2,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 40,
    overflow: 'hidden',
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

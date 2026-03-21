import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { GameChrome, GameMotion } from '@/constants/gameChrome';

type SessionProgressFooterProps = {
  bookTitle: string;
  progress: number;
  totalWords: number;
  placedWords: number;
  currentPosition: number;
  bottomOffset: number;
};

export function SessionProgressFooter({
  bookTitle,
  progress,
  totalWords,
  placedWords,
  currentPosition,
  bottomOffset,
}: SessionProgressFooterProps) {
  const [barWidth, setBarWidth] = useState(0);
  const fillWidth = useSharedValue(0);
  const markerLeft = useSharedValue(0);

  const onBarLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  useEffect(() => {
    if (barWidth <= 0) return;
    const pct = Math.min(100, Math.max(0, progress)) / 100;
    const posPct = totalWords > 0 ? Math.min(1, currentPosition / totalWords) : 0;
    fillWidth.value = withTiming(pct * barWidth, { duration: GameMotion.progressMs });
    markerLeft.value = withTiming(posPct * barWidth, { duration: GameMotion.markerMs });
  }, [barWidth, progress, currentPosition, totalWords, fillWidth, markerLeft]);

  const fillStyle = useAnimatedStyle(() => ({
    width: fillWidth.value,
  }));

  const markerStyle = useAnimatedStyle(() => ({
    left: markerLeft.value,
  }));

  return (
    <View style={[styles.wrap, { bottom: bottomOffset + FOOTER_LIFT_ABOVE_SAFE }]}>
      <View style={styles.row}>
        <View style={styles.titleRow}>
          <Ionicons name="book-outline" size={16} color="#4B5563" />
          <Text style={styles.title} numberOfLines={1}>
            {bookTitle}
          </Text>
        </View>
        <View style={styles.barOuter} onLayout={onBarLayout}>
          <View style={styles.track}>
            <Animated.View style={[styles.fillClip, fillStyle]}>
              <LinearGradient
                colors={[GameChrome.progressGradientStart, GameChrome.progressGradientEnd]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Animated.View style={[styles.marker, markerStyle]} />
            <View style={styles.numbers}>
              <Text style={styles.numPlaced}>{placedWords}</Text>
              <Text style={styles.numTotal}>{totalWords}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Thinner bar — less visual weight than the previous ~32px track. */
const BAR_H = 22;
/** Extra space between the home indicator / screen bottom and this chrome. */
const FOOTER_LIFT_ABOVE_SAFE = 16;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    marginRight: 4,
  },
  title: {
    fontSize: 14,
    fontStyle: 'italic',
    fontFamily: 'Georgia',
    color: '#4B5563',
    flex: 1,
  },
  barOuter: {
    width: '42%',
    maxWidth: 220,
    minWidth: 120,
    flexShrink: 0,
  },
  track: {
    height: BAR_H,
    borderRadius: BAR_H / 2,
    backgroundColor: GameChrome.progressTrack,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fillClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: BAR_H / 2,
    overflow: 'hidden',
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: GameChrome.marker,
    zIndex: 2,
    shadowColor: GameChrome.marker,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  numbers: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    zIndex: 3,
  },
  numPlaced: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  numTotal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5E54',
  },
});

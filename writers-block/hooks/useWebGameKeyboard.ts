import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { KeyboardLetterCandidate } from '@/components/game/samplePassageLogic';

export type WebKeyHighlight = {
  wordIndex: number;
  word: string;
  typedLen: number;
};

type UseWebGameKeyboardParams = {
  nextWordsByLetter: Map<string, KeyboardLetterCandidate>;
  onWordSelect: (index: number, pressedWord: string) => void;
  selectedSlotIndex: number;
};

function isTypingTargetIgnored(target: EventTarget | null): boolean {
  if (typeof document === 'undefined' || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

function letterFromKey(key: string): string | null {
  if (key.length !== 1) return null;
  const lower = key.toLowerCase();
  if (lower < 'a' || lower > 'z') return null;
  return lower;
}

/**
 * Web: physical keyboard highlights a letter’s candidate (like focusing that key);
 * Enter commits like a click; Space also commits when the canonical word was typed in full.
 * Sequential letters extend the highlight without clearing it.
 */
export function useWebGameKeyboard({
  nextWordsByLetter,
  onWordSelect,
  selectedSlotIndex,
}: UseWebGameKeyboardParams) {
  const [highlight, setHighlight] = useState<WebKeyHighlight | null>(null);
  const highlightRef = useRef<WebKeyHighlight | null>(null);
  highlightRef.current = highlight;

  const mapRef = useRef(nextWordsByLetter);
  mapRef.current = nextWordsByLetter;
  const onWordSelectRef = useRef(onWordSelect);
  onWordSelectRef.current = onWordSelect;

  const clearHighlight = useCallback(() => {
    setHighlight(null);
    highlightRef.current = null;
  }, []);

  useEffect(() => {
    highlightRef.current = null;
    setHighlight(null);
  }, [selectedSlotIndex]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTargetIgnored(e.target)) return;

      const map = mapRef.current;
      const h = highlightRef.current;

      if (e.key === 'Enter') {
        if (h) {
          onWordSelectRef.current(h.wordIndex, h.word);
          setHighlight(null);
          highlightRef.current = null;
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (e.key === ' ') {
        if (h && h.typedLen === h.word.length) {
          onWordSelectRef.current(h.wordIndex, h.word);
          setHighlight(null);
          highlightRef.current = null;
          e.preventDefault();
          e.stopPropagation();
        } else if (h && h.typedLen < h.word.length) {
          e.preventDefault();
        }
        return;
      }

      const ch = letterFromKey(e.key);
      if (!ch) return;

      const entry = map.get(ch.toUpperCase());

      if (h) {
        const nextChar = h.word[h.typedLen];
        if (nextChar !== undefined && nextChar === ch) {
          const next = { ...h, typedLen: h.typedLen + 1 };
          setHighlight(next);
          highlightRef.current = next;
          e.preventDefault();
          return;
        }
      }

      if (entry && entry.word[0] === ch) {
        const next = { wordIndex: entry.index, word: entry.word, typedLen: 1 };
        setHighlight(next);
        highlightRef.current = next;
        e.preventDefault();
        return;
      }

      if (h) {
        setHighlight(null);
        highlightRef.current = null;
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const setHighlightFromLetterFocus = useCallback((wordIndex: number, word: string) => {
    const next = { wordIndex, word, typedLen: 0 };
    setHighlight(next);
    highlightRef.current = next;
  }, []);

  return {
    highlight,
    clearHighlight,
    setHighlightFromLetterFocus,
  };
}

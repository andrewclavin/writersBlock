import { Platform } from 'react-native';

import * as bookConfigs from '../config/bookConfigs';

import type { BookJsonBundle } from './bookTypes';

const CACHE_NAME = 'writers-block:v1:book-json';
const BOOKS_PUBLIC_BASE_URL = '/books';

function getWebJsonUrls(bookId: string) {
  return {
    wordsUrl: `${BOOKS_PUBLIC_BASE_URL}/${bookId}/${bookId}.words.json`,
    lexiconUrl: `${BOOKS_PUBLIC_BASE_URL}/${bookId}/${bookId}.lexicon.json`,
  };
}

async function loadJsonFromWebCache(url: string) {
  // Some runtimes may not support Cache Storage (unlikely for expo web, but
  // we keep a fetch fallback).
  if (typeof caches === 'undefined') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url} (status ${res.status})`);
    return res.json();
  }

  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(url);
  if (match) return match.json();

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} (status ${res.status})`);

  // Cache Storage reads body streams; we must clone.
  await cache.put(url, res.clone());
  return res.json();
}

const nativeBookBundlesByBookId: Record<string, { words: unknown[]; lexicon: unknown[] }> = {
  'age-of-innocence': {
    words: require('../../books/age-of-innocence/age-of-innocence.words.json'),
    lexicon: require('../../books/age-of-innocence/age-of-innocence.lexicon.json'),
  },
  'great-gatsby': {
    words: require('../../books/great-gatsby/great-gatsby.words.json'),
    lexicon: require('../../books/great-gatsby/great-gatsby.lexicon.json'),
  },
};

export async function loadWordsAndLexicon(bookId: string): Promise<BookJsonBundle> {
  const bookConfig = (bookConfigs as any).getBookConfig(bookId) as { local: boolean } | null;

  if (Platform.OS === 'web' && bookConfig?.local) {
    throw new Error(`Book "${bookId}" is available only on-device (local-only).`);
  }

  if (Platform.OS === 'web') {
    const { wordsUrl, lexiconUrl } = getWebJsonUrls(bookId);
    const [words, lexicon] = await Promise.all([
      loadJsonFromWebCache(wordsUrl),
      loadJsonFromWebCache(lexiconUrl),
    ]);
    return { words, lexicon } as BookJsonBundle;
  }

  const bundle = nativeBookBundlesByBookId[bookId];
  if (!bundle) throw new Error(`No native bundle configured for bookId "${bookId}".`);

  return bundle as BookJsonBundle;
}


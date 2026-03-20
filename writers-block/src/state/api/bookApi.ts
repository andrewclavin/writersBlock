import { baseApi } from './baseApi';

import type { BookJsonBundle } from '../../data/bookTypes';
import { loadWordsAndLexicon } from '../../data/bookDataLoader';

import tinyLexicon from '../../data/fixtures/tiny-book.lexicon.json';
import tinyWords from '../../data/fixtures/tiny-book.words.json';

/** Stable id for bundled micro-fixture (parser-shaped JSON, no network). */
export const TINY_FIXTURE_BOOK_ID = 'tiny-fixture';

export const bookApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBookBundle: build.query<BookJsonBundle, string>({
      async queryFn(bookId) {
        if (bookId === TINY_FIXTURE_BOOK_ID) {
          return {
            data: {
              words: tinyWords as BookJsonBundle['words'],
              lexicon: tinyLexicon as BookJsonBundle['lexicon'],
            },
          };
        }
        try {
          const data = await loadWordsAndLexicon(bookId);
          return { data };
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Failed to load book';
          return { error: { status: 'FETCH_ERROR' as const, error: message } };
        }
      },
      providesTags: (_result, _err, bookId) => [
        { type: 'BookWords', id: bookId },
        { type: 'BookLexicon', id: bookId },
      ],
    }),
  }),
});

export const { useGetBookBundleQuery, useLazyGetBookBundleQuery } = bookApi;

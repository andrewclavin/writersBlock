import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Shared RTK Query API slice. Add endpoints via `injectEndpoints` in feature files
 * and re-export the generated hooks from those files.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/',
  }),
  tagTypes: ['BookWords', 'BookLexicon'],
  endpoints: () => ({}),
});

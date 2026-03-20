import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';

import { baseApi } from './api/baseApi';
import { sessionReducer } from './session/sessionSlice';
import { persistConfig } from './persist';

const rootReducer = combineReducers({
  session: sessionReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

// `redux-persist` typing can be overly strict around the persisted state shape;
// we cast here because the runtime reducer we pass is correct.
const persistedReducer = persistReducer(persistConfig as any, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // redux-persist dispatches actions with non-serializable payloads;
      // we ignore those to keep the default checks strict.
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE', 'persist/FLUSH', 'persist/PAUSE'],
        ignoredPaths: ['api'],
      },
    }).concat(baseApi.middleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;


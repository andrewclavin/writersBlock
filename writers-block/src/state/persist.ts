import type { PersistConfig } from 'redux-persist';

import AsyncStorage from '@react-native-async-storage/async-storage';

// Root reducer type is defined in `store.ts`. We keep this config loosely typed
// to avoid circular type dependencies.
export const persistConfig: PersistConfig<any> = {
  key: 'writers-block',
  storage: AsyncStorage,
  whitelist: ['session'],
  version: 1,
};


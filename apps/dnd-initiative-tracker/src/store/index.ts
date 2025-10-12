import { configureStore } from '@reduxjs/toolkit'
import combatReducer from './combatSlice'
import campaignsReducer from './campaignSlice'
import monsterLibraryReducer from './monsterLibrarySlice'
import type { RootState } from '../types'

/**
 * Configures the Redux store used by the tracker application.
 */
export const store = configureStore({
  reducer: {
    combat: combatReducer,
    campaigns: campaignsReducer,
    monsterLibrary: monsterLibraryReducer,
  },
})

export type AppDispatch = typeof store.dispatch
export type AppStore = typeof store
export type AppRootState = RootState

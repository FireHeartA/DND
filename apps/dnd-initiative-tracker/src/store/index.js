import { configureStore } from '@reduxjs/toolkit'
import combatReducer from './combatSlice'
import campaignsReducer from './campaignSlice'
import monsterLibraryReducer from './monsterLibrarySlice'

export const store = configureStore({
  reducer: {
    combat: combatReducer,
    campaigns: campaignsReducer,
    monsterLibrary: monsterLibraryReducer,
  },
})

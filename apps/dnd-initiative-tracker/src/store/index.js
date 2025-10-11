import { configureStore } from '@reduxjs/toolkit'
import combatReducer from './combatSlice'
import campaignsReducer from './campaignSlice'

export const store = configureStore({
  reducer: {
    combat: combatReducer,
    campaigns: campaignsReducer,
  },
})

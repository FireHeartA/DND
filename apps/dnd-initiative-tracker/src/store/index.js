import { configureStore } from '@reduxjs/toolkit'
import combatReducer from './combatSlice'

export const store = configureStore({
  reducer: {
    combat: combatReducer,
  },
})

import { createSlice, nanoid } from '@reduxjs/toolkit'

const initialState = {
  combatants: [],
}

const combatSlice = createSlice({
  name: 'combat',
  initialState,
  reducers: {
    addCombatant: {
      prepare({ name, maxHp, initiative, type }) {
        return {
          payload: {
            id: nanoid(),
            name,
            maxHp,
            initiative,
            currentHp: maxHp,
            createdAt: Date.now(),
            type: type === 'monster' ? 'monster' : 'player',
          },
        }
      },
      reducer(state, action) {
        state.combatants.push(action.payload)
      },
    },
    removeCombatant(state, action) {
      state.combatants = state.combatants.filter(
        (combatant) => combatant.id !== action.payload,
      )
    },
    applyDamage(state, action) {
      const { id, amount } = action.payload
      const combatant = state.combatants.find((entry) => entry.id === id)

      if (!combatant) return

      const nextHp = Math.max(0, combatant.currentHp - amount)
      combatant.currentHp = nextHp
    },
    applyHealing(state, action) {
      const { id, amount } = action.payload
      const combatant = state.combatants.find((entry) => entry.id === id)

      if (!combatant) return

      const nextHp = Math.min(combatant.maxHp, combatant.currentHp + amount)
      combatant.currentHp = nextHp
    },
    resetCombatant(state, action) {
      const combatant = state.combatants.find(
        (entry) => entry.id === action.payload,
      )

      if (!combatant) return

      combatant.currentHp = combatant.maxHp
    },
    clearMonsters(state) {
      state.combatants = state.combatants.filter(
        (combatant) => combatant.type !== 'monster',
      )
    },
  },
})

export const {
  addCombatant,
  removeCombatant,
  applyDamage,
  applyHealing,
  resetCombatant,
  clearMonsters,
} = combatSlice.actions

export default combatSlice.reducer

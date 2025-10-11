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
    updateInitiative(state, action) {
      const { id, initiative } = action.payload
      const combatant = state.combatants.find((entry) => entry.id === id)

      if (!combatant || !Number.isFinite(initiative)) return

      combatant.initiative = initiative
    },
    clearMonsters(state) {
      state.combatants = state.combatants.filter(
        (combatant) => combatant.type !== 'monster',
      )
    },
    loadState(state, action) {
      const { combatants } = action.payload || {}

      if (!Array.isArray(combatants)) {
        return
      }

      const sanitizedCombatants = combatants
        .map((combatant) => {
          const name =
            typeof combatant.name === 'string' ? combatant.name.trim() : ''
          const maxHpValue = Number.parseInt(combatant.maxHp, 10)
          const maxHp = Number.isFinite(maxHpValue)
            ? Math.max(1, Math.trunc(maxHpValue))
            : null
          const initiativeValue = Number.parseInt(combatant.initiative, 10)
          const initiative = Number.isFinite(initiativeValue)
            ? Math.trunc(initiativeValue)
            : null

          if (!name || maxHp === null || maxHp <= 0 || initiative === null) {
            return null
          }

          const currentHpValue = Number.parseInt(combatant.currentHp, 10)
          const currentHp = Number.isFinite(currentHpValue)
            ? Math.min(maxHp, Math.max(0, Math.trunc(currentHpValue)))
            : maxHp

          const createdAtValue = Number.parseInt(combatant.createdAt, 10)

          return {
            id:
              typeof combatant.id === 'string' && combatant.id
                ? combatant.id
                : nanoid(),
            name,
            maxHp,
            currentHp,
            initiative,
            createdAt: Number.isFinite(createdAtValue)
              ? createdAtValue
              : Date.now(),
            type: combatant.type === 'monster' ? 'monster' : 'player',
          }
        })
        .filter(Boolean)

      state.combatants = sanitizedCombatants
    },
  },
})

export const {
  addCombatant,
  removeCombatant,
  applyDamage,
  applyHealing,
  resetCombatant,
  updateInitiative,
  clearMonsters,
  loadState,
} = combatSlice.actions

export default combatSlice.reducer

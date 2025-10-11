import { createSlice, nanoid } from '@reduxjs/toolkit'

const initialState = {
  combatants: [],
  playerTemplates: [],
}

const combatSlice = createSlice({
  name: 'combat',
  initialState,
  reducers: {
    addCombatant: {
      prepare({
        name,
        maxHp,
        initiative,
        type,
        armorClass = null,
        notes = '',
        sourceTemplateId = null,
        sourceCampaignId = null,
        sourceMonsterId = null,
      }) {
        const parsedArmorClass = Number.parseInt(armorClass, 10)
        return {
          payload: {
            id: nanoid(),
            name,
            maxHp,
            initiative,
            currentHp: maxHp,
            createdAt: Date.now(),
            type: type === 'monster' ? 'monster' : 'player',
            armorClass: Number.isFinite(parsedArmorClass)
              ? Math.max(0, Math.trunc(parsedArmorClass))
              : null,
            notes: typeof notes === 'string' ? notes : '',
            sourceTemplateId:
              typeof sourceTemplateId === 'string' && sourceTemplateId
                ? sourceTemplateId
                : null,
            sourceCampaignId:
              typeof sourceCampaignId === 'string' && sourceCampaignId
                ? sourceCampaignId
                : null,
            sourceMonsterId:
              typeof sourceMonsterId === 'string' && sourceMonsterId
                ? sourceMonsterId
                : null,
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
    addPlayerTemplate: {
      prepare({ name, maxHp, armorClass = null, notes = '' }) {
        const parsedArmorClass = Number.parseInt(armorClass, 10)
        return {
          payload: {
            id: nanoid(),
            name,
            maxHp,
            armorClass: Number.isFinite(parsedArmorClass)
              ? Math.max(0, Math.trunc(parsedArmorClass))
              : null,
            notes: typeof notes === 'string' ? notes : '',
            createdAt: Date.now(),
          },
        }
      },
      reducer(state, action) {
        state.playerTemplates.push(action.payload)
      },
    },
    removePlayerTemplate(state, action) {
      state.playerTemplates = state.playerTemplates.filter(
        (template) => template.id !== action.payload,
      )
    },
    loadState(state, action) {
      const { combatants, playerTemplates } = action.payload || {}

      if (!Array.isArray(combatants)) {
        state.combatants = []
      } else {
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
            const armorClassValue = Number.parseInt(combatant.armorClass, 10)

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
              armorClass: Number.isFinite(armorClassValue)
                ? Math.max(0, Math.trunc(armorClassValue))
                : null,
              notes:
                typeof combatant.notes === 'string' ? combatant.notes : '',
            sourceTemplateId:
              typeof combatant.sourceTemplateId === 'string'
                ? combatant.sourceTemplateId
                : null,
            sourceCampaignId:
              typeof combatant.sourceCampaignId === 'string'
                ? combatant.sourceCampaignId
                : null,
            sourceMonsterId:
              typeof combatant.sourceMonsterId === 'string'
                ? combatant.sourceMonsterId
                : null,
          }
        })
        .filter(Boolean)

        state.combatants = sanitizedCombatants
      }

      if (Array.isArray(playerTemplates)) {
        const sanitizedTemplates = playerTemplates
          .map((template) => {
            const name =
              typeof template.name === 'string' ? template.name.trim() : ''
            const maxHpValue = Number.parseInt(template.maxHp, 10)
            const maxHp = Number.isFinite(maxHpValue)
              ? Math.max(1, Math.trunc(maxHpValue))
              : null

            if (!name || maxHp === null || maxHp <= 0) {
              return null
            }

            const armorClassValue = Number.parseInt(template.armorClass, 10)
            const createdAtValue = Number.parseInt(template.createdAt, 10)

            return {
              id:
                typeof template.id === 'string' && template.id
                  ? template.id
                  : nanoid(),
              name,
              maxHp,
              armorClass: Number.isFinite(armorClassValue)
                ? Math.max(0, Math.trunc(armorClassValue))
                : null,
              notes:
                typeof template.notes === 'string' ? template.notes : '',
              createdAt: Number.isFinite(createdAtValue)
                ? createdAtValue
                : Date.now(),
            }
          })
          .filter(Boolean)

        state.playerTemplates = sanitizedTemplates
      } else {
        state.playerTemplates = []
      }
    },
  },
})

export const {
  addCombatant,
  addPlayerTemplate,
  removeCombatant,
  applyDamage,
  applyHealing,
  resetCombatant,
  updateInitiative,
  clearMonsters,
  loadState,
  removePlayerTemplate,
} = combatSlice.actions

export default combatSlice.reducer

import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit'
import type {
  CombatState,
  Combatant,
  CombatantType,
  PlayerTemplate,
} from '../types'

/**
 * Ensures that a provided armor class value is a non-negative whole number or null.
 */
const normalizeArmorClass = (value: unknown): number | null => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return Math.max(0, Math.trunc(parsed))
}

/**
 * Creates a combatant record with the base fields required by the tracker.
 */
const createCombatant = (
  fields: Omit<Combatant, 'id' | 'currentHp' | 'createdAt'> & {
    id?: string
    currentHp?: number
    createdAt?: number
  },
): Combatant => ({
  id: fields.id ?? nanoid(),
  name: fields.name,
  maxHp: fields.maxHp,
  currentHp: fields.currentHp ?? fields.maxHp,
  initiative: fields.initiative,
  createdAt: fields.createdAt ?? Date.now(),
  type: fields.type,
  armorClass: fields.armorClass,
  notes: fields.notes,
  sourceTemplateId: fields.sourceTemplateId,
  sourceCampaignId: fields.sourceCampaignId,
  sourceMonsterId: fields.sourceMonsterId,
})

/**
 * Produces a sanitized combatant entry from untrusted data sources such as imports.
 */
const sanitizeCombatant = (value: unknown): Combatant | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<Combatant>
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
  const maxHp = Number.parseInt(String(candidate.maxHp ?? ''), 10)
  const initiative = Number.parseInt(String(candidate.initiative ?? ''), 10)

  if (!name || !Number.isFinite(maxHp) || maxHp <= 0 || !Number.isFinite(initiative)) {
    return null
  }

  const currentHp = Number.parseInt(String(candidate.currentHp ?? maxHp), 10)

  return createCombatant({
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : nanoid(),
    name,
    maxHp: Math.max(1, Math.trunc(maxHp)),
    currentHp: Number.isFinite(currentHp)
      ? Math.min(Math.max(0, Math.trunc(currentHp)), Math.max(1, Math.trunc(maxHp)))
      : Math.max(1, Math.trunc(maxHp)),
    initiative: Math.trunc(initiative),
    type: candidate.type === 'monster' ? 'monster' : 'player',
    armorClass: normalizeArmorClass(candidate.armorClass),
    notes: typeof candidate.notes === 'string' ? candidate.notes : '',
    sourceTemplateId:
      typeof candidate.sourceTemplateId === 'string' && candidate.sourceTemplateId
        ? candidate.sourceTemplateId
        : null,
    sourceCampaignId:
      typeof candidate.sourceCampaignId === 'string' && candidate.sourceCampaignId
        ? candidate.sourceCampaignId
        : null,
    sourceMonsterId:
      typeof candidate.sourceMonsterId === 'string' && candidate.sourceMonsterId
        ? candidate.sourceMonsterId
        : null,
    createdAt: Number.isFinite(candidate.createdAt)
      ? Math.trunc(Number(candidate.createdAt))
      : Date.now(),
  })
}

/**
 * Produces a sanitized player template from raw data.
 */
const sanitizeTemplate = (value: unknown): PlayerTemplate | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<PlayerTemplate>
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
  const maxHp = Number.parseInt(String(candidate.maxHp ?? ''), 10)

  if (!name || !Number.isFinite(maxHp) || maxHp <= 0) {
    return null
  }

  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : nanoid(),
    name,
    maxHp: Math.max(1, Math.trunc(maxHp)),
    armorClass: normalizeArmorClass(candidate.armorClass),
    notes: typeof candidate.notes === 'string' ? candidate.notes : '',
    createdAt: Number.isFinite(candidate.createdAt)
      ? Math.trunc(Number(candidate.createdAt))
      : Date.now(),
  }
}

const initialState: CombatState = {
  combatants: [],
  playerTemplates: [],
}

export interface AddCombatantArgs {
  name: string
  maxHp: number
  initiative: number
  type: CombatantType
  armorClass?: number | null
  notes?: string
  sourceTemplateId?: string | null
  sourceCampaignId?: string | null
  sourceMonsterId?: string | null
}

export interface UpdateInitiativeArgs {
  id: string
  initiative: number
}

export interface AdjustmentArgs {
  id: string
  amount: number
}

export interface LoadCombatStateArgs {
  combatants?: unknown
  playerTemplates?: unknown
}

const combatSlice = createSlice({
  name: 'combat',
  initialState,
  reducers: {
    /**
     * Adds a new combatant entry to the initiative list.
     */
    addCombatant: {
      prepare(args: AddCombatantArgs) {
        return { payload: args }
      },
      reducer(state, action: PayloadAction<AddCombatantArgs>) {
        const {
          name,
          maxHp,
          initiative,
          type,
          armorClass = null,
          notes = '',
          sourceTemplateId = null,
          sourceCampaignId = null,
          sourceMonsterId = null,
        } = action.payload

        const entry = createCombatant({
          name: name.trim(),
          maxHp: Math.max(1, Math.trunc(maxHp)),
          initiative: Math.trunc(initiative),
          type,
          armorClass: armorClass === null ? null : normalizeArmorClass(armorClass),
          notes,
          sourceTemplateId,
          sourceCampaignId,
          sourceMonsterId,
        })

        state.combatants.push(entry)
      },
    },
    /**
     * Removes a combatant from the list by identifier.
     */
    removeCombatant(state, action: PayloadAction<string>) {
      state.combatants = state.combatants.filter((combatant) => combatant.id !== action.payload)
    },
    /**
     * Applies damage to a combatant by reducing their current hit points.
     */
    applyDamage(state, action: PayloadAction<AdjustmentArgs>) {
      const { id, amount } = action.payload
      const combatant = state.combatants.find((entry) => entry.id === id)
      if (!combatant) {
        return
      }
      combatant.currentHp = Math.max(0, combatant.currentHp - Math.max(0, Math.trunc(amount)))
    },
    /**
     * Applies healing to a combatant by increasing their current hit points.
     */
    applyHealing(state, action: PayloadAction<AdjustmentArgs>) {
      const { id, amount } = action.payload
      const combatant = state.combatants.find((entry) => entry.id === id)
      if (!combatant) {
        return
      }
      const healedAmount = Math.max(0, Math.trunc(amount))
      combatant.currentHp = Math.min(combatant.maxHp, combatant.currentHp + healedAmount)
    },
    /**
     * Restores a combatant's hit points to their maximum value.
     */
    resetCombatant(state, action: PayloadAction<string>) {
      const combatant = state.combatants.find((entry) => entry.id === action.payload)
      if (!combatant) {
        return
      }
      combatant.currentHp = combatant.maxHp
    },
    /**
     * Updates the stored initiative value for a combatant.
     */
    updateInitiative(state, action: PayloadAction<UpdateInitiativeArgs>) {
      const { id, initiative } = action.payload
      const combatant = state.combatants.find((entry) => entry.id === id)
      if (!combatant) {
        return
      }
      combatant.initiative = Math.trunc(initiative)
    },
    /**
     * Removes all monsters from the initiative order while keeping player characters.
     */
    clearMonsters(state) {
      state.combatants = state.combatants.filter((combatant) => combatant.type !== 'monster')
    },
    /**
     * Adds a reusable player template to the library.
     */
    addPlayerTemplate: {
      prepare(args: Omit<PlayerTemplate, 'id' | 'createdAt'>) {
        return { payload: args }
      },
      reducer(state, action: PayloadAction<Omit<PlayerTemplate, 'id' | 'createdAt'>>) {
        const { name, maxHp, armorClass = null, notes = '' } = action.payload
        const template: PlayerTemplate = {
          id: nanoid(),
          name: name.trim(),
          maxHp: Math.max(1, Math.trunc(maxHp)),
          armorClass: armorClass === null ? null : normalizeArmorClass(armorClass),
          notes,
          createdAt: Date.now(),
        }
        state.playerTemplates.push(template)
      },
    },
    /**
     * Removes a player template by identifier.
     */
    removePlayerTemplate(state, action: PayloadAction<string>) {
      state.playerTemplates = state.playerTemplates.filter((template) => template.id !== action.payload)
    },
    /**
     * Loads combat data exported from disk and sanitizes it.
     */
    loadState(state, action: PayloadAction<LoadCombatStateArgs>) {
      const { combatants, playerTemplates } = action.payload

      const sanitizedCombatants = Array.isArray(combatants)
        ? (combatants.map(sanitizeCombatant).filter(Boolean) as Combatant[])
        : []

      const sanitizedTemplates = Array.isArray(playerTemplates)
        ? (playerTemplates.map(sanitizeTemplate).filter(Boolean) as PlayerTemplate[])
        : []

      state.combatants = sanitizedCombatants
      state.playerTemplates = sanitizedTemplates
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
  addPlayerTemplate,
  removePlayerTemplate,
  loadState,
} = combatSlice.actions

export default combatSlice.reducer

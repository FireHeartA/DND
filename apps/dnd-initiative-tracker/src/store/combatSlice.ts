import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit'
import type {
  CombatState,
  Combatant,
  CombatantTag,
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
 * Normalizes a character profile link to an http(s) URL or clears it.
 */
const sanitizeProfileUrl = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : ''
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
  profileUrl: fields.profileUrl ?? '',
  notes: fields.notes,
  tags: Array.isArray(fields.tags) ? fields.tags : [],
  sourceTemplateId: fields.sourceTemplateId,
  sourceCampaignId: fields.sourceCampaignId,
  sourceMonsterId: fields.sourceMonsterId,
})

/**
 * Produces a normalized array of combatant tags from arbitrary input.
 */
const sanitizeCombatantTags = (value: unknown): CombatantTag[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const candidate = entry as Partial<CombatantTag>
      const title = typeof candidate.title === 'string' ? candidate.title.trim() : ''
      const tagValue = typeof candidate.value === 'string' ? candidate.value.trim() : ''

      if (!title || !tagValue) {
        return null
      }

      return { title, value: tagValue }
    })
    .filter(Boolean) as CombatantTag[]
}

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
    profileUrl: sanitizeProfileUrl(candidate.profileUrl),
    notes: typeof candidate.notes === 'string' ? candidate.notes : '',
    tags: sanitizeCombatantTags((candidate as { tags?: unknown }).tags),
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
    profileUrl: sanitizeProfileUrl(candidate.profileUrl),
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
  profileUrl?: string | null
  notes?: string
  tags?: CombatantTag[]
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
          profileUrl = null,
          notes = '',
          tags = [],
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
          profileUrl: sanitizeProfileUrl(profileUrl),
          notes,
          tags,
          sourceTemplateId,
          sourceCampaignId,
          sourceMonsterId,
        })

        state.combatants.push(entry)
      },
    },
    /**
     * Adds or updates a tag on a combatant using the provided title.
     */
    setCombatantTag(state, action: PayloadAction<{ id: string; title: string; value: string }>) {
      const { id, title, value } = action.payload
      const combatant = state.combatants.find((entry) => entry.id === id)

      if (!combatant) {
        return
      }

      const normalizedTitle = title.trim()
      const normalizedValue = value.trim()

      if (!normalizedTitle || !normalizedValue) {
        return
      }

      const existingTag = combatant.tags.find(
        (tag) => tag.title.toLowerCase() === normalizedTitle.toLowerCase(),
      )

      if (existingTag) {
        existingTag.title = normalizedTitle
        existingTag.value = normalizedValue
        return
      }

      combatant.tags.push({ title: normalizedTitle, value: normalizedValue })
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
     * Removes all player characters from the initiative order while keeping monsters.
     */
    clearPlayers(state) {
      state.combatants = state.combatants.filter((combatant) => combatant.type !== 'player')
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
          profileUrl: sanitizeProfileUrl(action.payload.profileUrl),
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
  clearPlayers,
  setCombatantTag,
  addPlayerTemplate,
  removePlayerTemplate,
  loadState,
} = combatSlice.actions

export default combatSlice.reducer

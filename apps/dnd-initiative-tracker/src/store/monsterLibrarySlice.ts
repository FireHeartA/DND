import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit'
import { buildMonsterNotes, buildMonsterTags } from '../utils/dndBeyondMonsterParser'
import type {
  MonsterAbilityScores,
  MonsterDetails,
  MonsterLibraryEntry,
  MonsterLibraryState,
} from '../types'

/**
 * Removes leading and trailing whitespace and rejects non-string inputs.
 */
const sanitizeString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ''
}

/**
 * Returns a string representation of optional text fields, preserving blanks as empty strings.
 */
const sanitizeOptionalString = (value: unknown): string => {
  const normalized = sanitizeString(value)
  return normalized || ''
}

/**
 * Converts optional strings into nullable values so absence can be tracked explicitly.
 */
const sanitizeNullableString = (value: unknown): string | null => {
  const normalized = sanitizeString(value)
  return normalized || null
}

/**
 * Validates and normalizes URLs coming from imports or API responses.
 */
const sanitizeUrl = (value: unknown): string => {
  const raw = sanitizeString(value)
  if (!raw) {
    return ''
  }
  try {
    const parsed = new URL(raw, 'https://www.dndbeyond.com')
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return ''
  }
}

/**
 * Parses a number from mixed input and returns null for invalid values.
 */
const sanitizeNumber = (value: unknown): number | null => {
  const number = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(number) ? number : null
}

/**
 * Ensures non-negative counts are stored, defaulting to zero when invalid.
 */
const sanitizeNonNegativeNumber = (value: unknown): number => {
  const number = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(number) || number < 0) {
    return 0
  }
  return number
}

/**
 * Normalizes timestamps while defaulting to the current time for invalid inputs.
 */
const sanitizeTimestamp = (value: unknown): number => {
  const number = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(number) && number > 0 ? number : Date.now()
}

/**
 * Parses timestamps that may be absent, returning null when no valid value exists.
 */
const sanitizeNullableTimestamp = (value: unknown): number | null => {
  const number = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(number) && number > 0 ? number : null
}

/**
 * Creates a cleaned string array without duplicates for rich text fields.
 */
const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }
  const result: string[] = []
  value.forEach((entry) => {
    const sanitized = sanitizeString(entry)
    if (sanitized && !result.includes(sanitized)) {
      result.push(sanitized)
    }
  })
  return result
}

/**
 * Maps ability score keys into a consistent object shape.
 */
const sanitizeAbilityScores = (value: unknown): MonsterAbilityScores => {
  const keys: Array<keyof MonsterAbilityScores> = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  const scores = Object.fromEntries(keys.map((key) => [key, null])) as MonsterAbilityScores
  keys.forEach((key) => {
    const raw = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : null
    scores[key] = sanitizeNumber(raw)
  })
  return scores
}

/**
 * Produces a normalized monster record suitable for storage in Redux.
 */
const sanitizeMonster = (monster: unknown): MonsterDetails | null => {
  if (!monster || typeof monster !== 'object') {
    return null
  }

  const candidate = monster as Partial<MonsterDetails> & { id?: string }
  const name = sanitizeString(candidate.name)
  if (!name) {
    return null
  }

  const slug =
    sanitizeString((candidate as { slug?: string }).slug) ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')

  const referenceId = sanitizeNullableString((candidate as { referenceId?: string }).referenceId)
  const sourceUrl = sanitizeUrl(candidate.sourceUrl)
  const typeLine = sanitizeOptionalString((candidate as { typeLine?: string }).typeLine)
  const armorClass = sanitizeNumber(candidate.armorClass)
  const armorNotes = sanitizeOptionalString((candidate as { armorNotes?: string }).armorNotes)
  const hitPoints = sanitizeNumber((candidate as { hitPoints?: number }).hitPoints)
  const hitDice = sanitizeOptionalString((candidate as { hitDice?: string }).hitDice)
  const speed = sanitizeOptionalString((candidate as { speed?: string }).speed)
  const abilityScores = sanitizeAbilityScores((candidate as { abilityScores?: unknown }).abilityScores)
  const savingThrows = sanitizeOptionalString((candidate as { savingThrows?: string }).savingThrows)
  const skills = sanitizeOptionalString((candidate as { skills?: string }).skills)
  const damageVulnerabilities = sanitizeOptionalString(
    (candidate as { damageVulnerabilities?: string }).damageVulnerabilities,
  )
  const damageResistances = sanitizeOptionalString(
    (candidate as { damageResistances?: string }).damageResistances,
  )
  const damageImmunities = sanitizeOptionalString(
    (candidate as { damageImmunities?: string }).damageImmunities,
  )
  const conditionImmunities = sanitizeOptionalString(
    (candidate as { conditionImmunities?: string }).conditionImmunities,
  )
  const senses = sanitizeOptionalString((candidate as { senses?: string }).senses)
  const languages = sanitizeOptionalString((candidate as { languages?: string }).languages)
  const challengeRating = sanitizeOptionalString(
    (candidate as { challengeRating?: string }).challengeRating,
  )
  const challengeXp = sanitizeOptionalString((candidate as { challengeXp?: string }).challengeXp)
  const proficiencyBonus = sanitizeOptionalString(
    (candidate as { proficiencyBonus?: string }).proficiencyBonus,
  )
  const traits = sanitizeStringArray((candidate as { traits?: unknown }).traits)
  const actions = sanitizeStringArray((candidate as { actions?: unknown }).actions)
  const bonusActions = sanitizeStringArray((candidate as { bonusActions?: unknown }).bonusActions)
  const reactions = sanitizeStringArray((candidate as { reactions?: unknown }).reactions)
  const legendaryActions = sanitizeStringArray(
    (candidate as { legendaryActions?: unknown }).legendaryActions,
  )
  const mythicActions = sanitizeStringArray((candidate as { mythicActions?: unknown }).mythicActions)
  const lairActions = sanitizeStringArray((candidate as { lairActions?: unknown }).lairActions)
  const regionalEffects = sanitizeStringArray(
    (candidate as { regionalEffects?: unknown }).regionalEffects,
  )
  const description = sanitizeStringArray((candidate as { description?: unknown }).description)
  const habitat = sanitizeOptionalString((candidate as { habitat?: string }).habitat)
  const source = sanitizeOptionalString((candidate as { source?: string }).source)
  const tags = sanitizeStringArray((candidate as { tags?: unknown }).tags)
  const notes = sanitizeOptionalString((candidate as { notes?: string }).notes)

  const importedAt = sanitizeTimestamp((candidate as { importedAt?: number }).importedAt)
  const updatedAt = sanitizeTimestamp((candidate as { updatedAt?: number }).updatedAt ?? importedAt)
  const totalUsageCount = sanitizeNonNegativeNumber(
    (candidate as { totalUsageCount?: number }).totalUsageCount,
  )
  const lastUsedAt = sanitizeNullableTimestamp((candidate as { lastUsedAt?: number }).lastUsedAt)

  const id = sanitizeString(candidate.id)

  const sanitized: MonsterDetails = {
    id: id || nanoid(),
    name,
    slug,
    referenceId,
    sourceUrl,
    typeLine,
    armorClass,
    armorNotes,
    hitPoints,
    hitDice,
    speed,
    abilityScores,
    savingThrows,
    skills,
    damageVulnerabilities,
    damageResistances,
    damageImmunities,
    conditionImmunities,
    senses,
    languages,
    challengeRating,
    challengeXp,
    proficiencyBonus,
    traits,
    actions,
    bonusActions,
    reactions,
    legendaryActions,
    mythicActions,
    lairActions,
    regionalEffects,
    description,
    habitat,
    source,
    tags,
    notes,
    importedAt,
    updatedAt,
    totalUsageCount,
    lastUsedAt,
  }

  if (sanitized.tags.length === 0) {
    sanitized.tags = buildMonsterTags(sanitized)
  }

  sanitized.notes = sanitizeOptionalString(buildMonsterNotes(sanitized))

  return sanitized
}

/**
 * Validates a campaign library entry to make sure it references a known monster.
 */
const sanitizeLibraryEntry = (
  entry: unknown,
  monsters: Record<string, MonsterDetails>,
): MonsterLibraryEntry | null => {
  if (!entry || typeof entry !== 'object') {
    return null
  }
  const candidate = entry as Partial<MonsterLibraryEntry>
  const monsterId = sanitizeString(candidate.monsterId)
  if (!monsterId || !monsters[monsterId]) {
    return null
  }
  return {
    monsterId,
    addedAt: sanitizeTimestamp(candidate.addedAt),
    usageCount: sanitizeNonNegativeNumber(candidate.usageCount),
    lastUsedAt: sanitizeNullableTimestamp(candidate.lastUsedAt),
  }
}

/**
 * Ensures that a campaign has a monster library array to operate on.
 */
const ensureCampaignLibrary = (
  state: MonsterLibraryState,
  campaignId: string | number | null,
): MonsterLibraryEntry[] | null => {
  if (!campaignId) {
    return null
  }
  const key = String(campaignId)
  if (!state.campaignLibraries[key]) {
    state.campaignLibraries[key] = []
  }
  return state.campaignLibraries[key]
}

/**
 * Finds a matching monster ID using either the reference ID or slug values.
 */
const findMonsterId = (
  state: MonsterLibraryState,
  slug: string,
  referenceId: string | null,
): string | null => {
  if (referenceId) {
    const matchByReference = Object.values(state.monsters).find(
      (entry) => entry.referenceId === referenceId,
    )
    if (matchByReference) {
      return matchByReference.id
    }
  }

  if (slug) {
    const matchBySlug = Object.values(state.monsters).find((entry) => entry.slug === slug)
    if (matchBySlug) {
      return matchBySlug.id
    }
  }

  return null
}

/**
 * Cleans up monsters that are no longer referenced by campaigns or favorites.
 */
const removeMonsterIfUnreferenced = (state: MonsterLibraryState, monsterId: string): void => {
  if (!monsterId || !state.monsters[monsterId]) {
    return
  }

  const referencedInCampaign = Object.values(state.campaignLibraries).some((library) =>
    library.some((entry) => entry.monsterId === monsterId),
  )

  const isFavorite = state.favorites.includes(monsterId)

  if (!referencedInCampaign && !isFavorite) {
    delete state.monsters[monsterId]
  }
}

const initialState: MonsterLibraryState = {
  monsters: {},
  campaignLibraries: {},
  favorites: [],
}

export interface ImportMonsterArgs {
  campaignId?: string | null
  monster: MonsterDetails | Record<string, unknown>
}

export interface UpdateMonsterDetailsArgs {
  monsterId: string
  name?: string
  description?: string | string[]
  tags?: string | string[]
}

export interface RemoveMonsterFromCampaignArgs {
  campaignId: string | number | null
  monsterId: string
}

export interface RecordMonsterUsageArgs {
  monsterId: string
  campaignId?: string | null
}

export interface LoadMonsterLibraryArgs {
  monsters?: unknown
  campaignLibraries?: unknown
  favorites?: unknown
}

const monsterLibrarySlice = createSlice({
  name: 'monsterLibrary',
  initialState,
  reducers: {
    /**
     * Imports a monster into the global library and optionally links it to a campaign.
     */
    importMonster: {
      prepare({ campaignId = null, monster }: ImportMonsterArgs) {
        return {
          payload: {
            campaignId: campaignId ? String(campaignId) : null,
            monster,
          },
        }
      },
      reducer(state, action: PayloadAction<{ campaignId: string | null; monster: unknown }>) {
        const { campaignId, monster } = action.payload
        const sanitizedMonster = sanitizeMonster(monster)
        if (!sanitizedMonster) {
          return
        }

        let monsterId = findMonsterId(state, sanitizedMonster.slug, sanitizedMonster.referenceId)

        if (monsterId) {
          const existing = state.monsters[monsterId]
          state.monsters[monsterId] = {
            ...existing,
            ...sanitizedMonster,
            id: monsterId,
            importedAt: existing.importedAt ?? sanitizedMonster.importedAt,
            updatedAt: Date.now(),
            totalUsageCount: existing.totalUsageCount ?? sanitizedMonster.totalUsageCount,
            lastUsedAt: existing.lastUsedAt ?? sanitizedMonster.lastUsedAt,
          }
        } else {
          monsterId = sanitizedMonster.id || nanoid()
          state.monsters[monsterId] = {
            ...sanitizedMonster,
            id: monsterId,
            importedAt: Date.now(),
            updatedAt: Date.now(),
            totalUsageCount: sanitizedMonster.totalUsageCount ?? 0,
            lastUsedAt: sanitizedMonster.lastUsedAt ?? null,
          }
        }

        if (campaignId) {
          const library = ensureCampaignLibrary(state, campaignId)
          if (!library) {
            return
          }
          const existingEntry = library.find((entry) => entry.monsterId === monsterId)
          if (existingEntry) {
            existingEntry.addedAt = existingEntry.addedAt || Date.now()
          } else {
            library.push({
              monsterId,
              addedAt: Date.now(),
              usageCount: 0,
              lastUsedAt: null,
            })
          }
        }
      },
    },
    /**
     * Updates editable fields for a stored monster entry.
     */
    updateMonsterDetails: {
      prepare({ monsterId, name, description, tags }: UpdateMonsterDetailsArgs) {
        return {
          payload: {
            monsterId: sanitizeString(monsterId),
            name,
            description,
            tags,
          },
        }
      },
      reducer(state, action: PayloadAction<UpdateMonsterDetailsArgs>) {
        const { monsterId, name, description, tags } = action.payload
        if (!monsterId) {
          return
        }

        const existing = state.monsters[monsterId]
        if (!existing) {
          return
        }

        const updates: Partial<MonsterDetails> = {}

        if (typeof name === 'string') {
          const sanitizedName = sanitizeString(name)
          if (!sanitizedName) {
            return
          }
          updates.name = sanitizedName
        }

        if (typeof description !== 'undefined') {
          let normalizedDescription: string[] = []
          if (Array.isArray(description)) {
            normalizedDescription = sanitizeStringArray(description)
          } else if (typeof description === 'string') {
            normalizedDescription = description
              .split(/\r?\n/)
              .map((entry) => sanitizeString(entry))
              .filter(Boolean)
          }
          updates.description = normalizedDescription
        }

        if (typeof tags !== 'undefined') {
          let normalizedTags: string[] = []
          if (Array.isArray(tags)) {
            normalizedTags = sanitizeStringArray(tags)
          } else if (typeof tags === 'string') {
            normalizedTags = sanitizeStringArray([tags])
          }
          updates.tags = normalizedTags
        }

        const merged: MonsterDetails = {
          ...existing,
          ...updates,
          updatedAt: Date.now(),
        }

        if (!('description' in updates)) {
          merged.description = Array.isArray(existing.description) ? existing.description : []
        }

        if (!('tags' in updates)) {
          merged.tags = Array.isArray(existing.tags) ? existing.tags : []
          if (merged.tags.length === 0) {
            merged.tags = buildMonsterTags(merged)
          }
        } else {
          merged.tags = Array.isArray(merged.tags) ? merged.tags : []
        }

        merged.notes = sanitizeOptionalString(buildMonsterNotes(merged))

        state.monsters[monsterId] = merged
      },
    },
    /**
     * Detaches a monster from a campaign roster and removes it if unused elsewhere.
     */
    removeMonsterFromCampaign(state, action: PayloadAction<RemoveMonsterFromCampaignArgs>) {
      const { campaignId, monsterId } = action.payload
      const key = campaignId ? String(campaignId) : null
      if (!key || !state.campaignLibraries[key]) {
        return
      }

      state.campaignLibraries[key] = state.campaignLibraries[key].filter(
        (entry) => entry.monsterId !== monsterId,
      )

      if (state.campaignLibraries[key].length === 0) {
        delete state.campaignLibraries[key]
      }

      removeMonsterIfUnreferenced(state, monsterId)
    },
    /**
     * Toggles whether a monster is marked as a global favorite.
     */
    toggleMonsterFavorite(state, action: PayloadAction<string>) {
      const monsterId = sanitizeString(action.payload)
      if (!monsterId || !state.monsters[monsterId]) {
        return
      }
      const index = state.favorites.indexOf(monsterId)
      if (index === -1) {
        state.favorites.push(monsterId)
      } else {
        state.favorites.splice(index, 1)
        removeMonsterIfUnreferenced(state, monsterId)
      }
    },
    /**
     * Records how often a monster has been used in combat encounters.
     */
    recordMonsterUsage(state, action: PayloadAction<RecordMonsterUsageArgs>) {
      const { monsterId, campaignId = null } = action.payload
      const monster = state.monsters[monsterId]
      if (!monster) {
        return
      }

      monster.totalUsageCount = (monster.totalUsageCount || 0) + 1
      monster.lastUsedAt = Date.now()

      if (!campaignId) {
        return
      }

      const library = ensureCampaignLibrary(state, campaignId)
      if (!library) {
        return
      }

      let entry = library.find((item) => item.monsterId === monsterId)
      if (!entry) {
        entry = {
          monsterId,
          addedAt: Date.now(),
          usageCount: 0,
          lastUsedAt: null,
        }
        library.push(entry)
      }

      entry.usageCount = (entry.usageCount || 0) + 1
      entry.lastUsedAt = Date.now()
    },
    /**
     * Loads monster library data exported from disk while sanitizing every field.
     */
    loadState(state, action: PayloadAction<LoadMonsterLibraryArgs>) {
      const { monsters, campaignLibraries, favorites } = action.payload

      const sanitizedMonsters: Record<string, MonsterDetails> = {}
      if (monsters && typeof monsters === 'object') {
        Object.entries(monsters as Record<string, unknown>).forEach(([key, value]) => {
          const sanitized = sanitizeMonster(value)
          if (!sanitized) {
            return
          }
          const monsterId = sanitized.id || sanitizeString(key) || nanoid()
          sanitizedMonsters[monsterId] = {
            ...sanitized,
            id: monsterId,
          }
        })
      }

      state.monsters = sanitizedMonsters

      const sanitizedLibraries: Record<string, MonsterLibraryEntry[]> = {}
      if (campaignLibraries && typeof campaignLibraries === 'object') {
        Object.entries(campaignLibraries as Record<string, unknown>).forEach(([campaignId, entries]) => {
          if (!Array.isArray(entries)) {
            return
          }
          const sanitizedEntries = entries
            .map((entry) => sanitizeLibraryEntry(entry, sanitizedMonsters))
            .filter(Boolean) as MonsterLibraryEntry[]
          if (sanitizedEntries.length > 0) {
            sanitizedLibraries[String(campaignId)] = sanitizedEntries
          }
        })
      }
      state.campaignLibraries = sanitizedLibraries

      if (Array.isArray(favorites)) {
        state.favorites = favorites
          .map((entry) => sanitizeString(entry))
          .filter((entry, index, array) => entry && array.indexOf(entry) === index && sanitizedMonsters[entry])
      } else {
        state.favorites = []
      }
    },
  },
})

export const {
  importMonster,
  updateMonsterDetails,
  removeMonsterFromCampaign,
  toggleMonsterFavorite,
  recordMonsterUsage,
  loadState,
} = monsterLibrarySlice.actions

export default monsterLibrarySlice.reducer

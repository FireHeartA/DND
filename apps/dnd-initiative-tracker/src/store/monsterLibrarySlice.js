import { createSlice, nanoid } from '@reduxjs/toolkit'

const initialState = {
  monsters: {},
  campaignLibraries: {},
  favorites: [],
}

const sanitizeString = (value) => {
  if (typeof value !== 'string') {
    return ''
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ''
}

const sanitizeOptionalString = (value) => {
  const normalized = sanitizeString(value)
  return normalized || ''
}

const sanitizeNullableString = (value) => {
  const normalized = sanitizeString(value)
  return normalized || null
}

const sanitizeUrl = (value) => {
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

const sanitizeNumber = (value) => {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) ? number : null
}

const sanitizeNonNegativeNumber = (value) => {
  const number = Number.parseInt(value, 10)
  if (!Number.isFinite(number) || number < 0) {
    return 0
  }
  return number
}

const sanitizeTimestamp = (value) => {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) && number > 0 ? number : Date.now()
}

const sanitizeNullableTimestamp = (value) => {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) && number > 0 ? number : null
}

const sanitizeStringArray = (value) => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((entry) => sanitizeString(entry))
    .filter((entry, index, array) => entry && array.indexOf(entry) === index)
}

const sanitizeAbilityScores = (value) => {
  const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  const scores = {}
  keys.forEach((key) => {
    const raw = value && typeof value === 'object' ? value[key] : null
    scores[key] = sanitizeNumber(raw)
  })
  return scores
}

const sanitizeMonster = (monster) => {
  if (!monster || typeof monster !== 'object') {
    return null
  }

  const name = sanitizeString(monster.name)
  if (!name) {
    return null
  }

  const slug =
    sanitizeString(monster.slug) ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
  const referenceId = sanitizeNullableString(monster.referenceId)
  const sourceUrl = sanitizeUrl(monster.sourceUrl)
  const typeLine = sanitizeOptionalString(monster.typeLine)
  const armorClass = sanitizeNumber(monster.armorClass)
  const armorNotes = sanitizeOptionalString(monster.armorNotes)
  const hitPoints = sanitizeNumber(monster.hitPoints)
  const hitDice = sanitizeOptionalString(monster.hitDice)
  const speed = sanitizeOptionalString(monster.speed)
  const abilityScores = sanitizeAbilityScores(monster.abilityScores || {})
  const savingThrows = sanitizeOptionalString(monster.savingThrows)
  const skills = sanitizeOptionalString(monster.skills)
  const damageVulnerabilities = sanitizeOptionalString(monster.damageVulnerabilities)
  const damageResistances = sanitizeOptionalString(monster.damageResistances)
  const damageImmunities = sanitizeOptionalString(monster.damageImmunities)
  const conditionImmunities = sanitizeOptionalString(monster.conditionImmunities)
  const senses = sanitizeOptionalString(monster.senses)
  const languages = sanitizeOptionalString(monster.languages)
  const challengeRating = sanitizeOptionalString(monster.challengeRating)
  const challengeXp = sanitizeOptionalString(monster.challengeXp)
  const proficiencyBonus = sanitizeOptionalString(monster.proficiencyBonus)
  const traits = sanitizeStringArray(monster.traits)
  const actions = sanitizeStringArray(monster.actions)
  const bonusActions = sanitizeStringArray(monster.bonusActions)
  const reactions = sanitizeStringArray(monster.reactions)
  const legendaryActions = sanitizeStringArray(monster.legendaryActions)
  const mythicActions = sanitizeStringArray(monster.mythicActions)
  const lairActions = sanitizeStringArray(monster.lairActions)
  const regionalEffects = sanitizeStringArray(monster.regionalEffects)
  const description = sanitizeStringArray(monster.description)
  const habitat = sanitizeOptionalString(monster.habitat)
  const source = sanitizeOptionalString(monster.source)
  const notes = sanitizeOptionalString(monster.notes)

  const importedAt = sanitizeTimestamp(monster.importedAt)
  const updatedAt = sanitizeTimestamp(monster.updatedAt || importedAt)
  const totalUsageCount = sanitizeNonNegativeNumber(monster.totalUsageCount)
  const lastUsedAt = sanitizeNullableTimestamp(monster.lastUsedAt)

  return {
    id:
      typeof monster.id === 'string' && monster.id.trim().length > 0
        ? monster.id.trim()
        : null,
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
    notes,
    importedAt,
    updatedAt,
    totalUsageCount,
    lastUsedAt,
  }
}

const sanitizeLibraryEntry = (entry, monsters) => {
  if (!entry || typeof entry !== 'object') {
    return null
  }
  const monsterId = sanitizeString(entry.monsterId)
  if (!monsterId || !monsters[monsterId]) {
    return null
  }
  return {
    monsterId,
    addedAt: sanitizeTimestamp(entry.addedAt),
    usageCount: sanitizeNonNegativeNumber(entry.usageCount),
    lastUsedAt: sanitizeNullableTimestamp(entry.lastUsedAt),
  }
}

const ensureCampaignLibrary = (state, campaignId) => {
  if (!campaignId) {
    return null
  }
  const key = String(campaignId)
  if (!state.campaignLibraries[key]) {
    state.campaignLibraries[key] = []
  }
  return state.campaignLibraries[key]
}

const findMonsterId = (state, slug, referenceId) => {
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

const removeMonsterIfUnreferenced = (state, monsterId) => {
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

const monsterLibrarySlice = createSlice({
  name: 'monsterLibrary',
  initialState,
  reducers: {
    importMonster: {
      prepare({ campaignId = null, monster }) {
        return {
          payload: {
            campaignId: campaignId ? String(campaignId) : null,
            monster,
          },
        }
      },
      reducer(state, action) {
        const { campaignId, monster } = action.payload || {}
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
    removeMonsterFromCampaign(state, action) {
      const { campaignId, monsterId } = action.payload || {}
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
    toggleMonsterFavorite(state, action) {
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
    recordMonsterUsage(state, action) {
      const { monsterId, campaignId = null } = action.payload || {}
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
    loadState(state, action) {
      const { monsters, campaignLibraries, favorites } = action.payload || {}

      const sanitizedMonsters = {}
      if (monsters && typeof monsters === 'object') {
        Object.entries(monsters).forEach(([key, value]) => {
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

      const sanitizedLibraries = {}
      if (campaignLibraries && typeof campaignLibraries === 'object') {
        Object.entries(campaignLibraries).forEach(([campaignId, entries]) => {
          if (!Array.isArray(entries)) {
            return
          }
          const sanitizedEntries = entries
            .map((entry) => sanitizeLibraryEntry(entry, sanitizedMonsters))
            .filter(Boolean)
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
  removeMonsterFromCampaign,
  toggleMonsterFavorite,
  recordMonsterUsage,
  loadState,
} = monsterLibrarySlice.actions

export default monsterLibrarySlice.reducer


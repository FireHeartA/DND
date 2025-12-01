import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit'
import type { Campaign, CampaignCharacter, CampaignState } from '../types'

/**
 * Trims a string and ensures it is safe to store as a campaign or character name.
 */
const sanitizeName = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ''
}

/**
 * Produces a cleaned-up note field while preserving intentional whitespace.
 */
const sanitizeNotes = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

/**
 * Ensures profile links are safe to render by restricting to http(s) URLs.
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

const sanitizeTagList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const normalized: string[] = []

  value.forEach((entry) => {
    if (typeof entry !== 'string') {
      return
    }
    const cleaned = entry.trim()
    if (!cleaned) {
      return
    }
    const key = cleaned.toLowerCase()
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    normalized.push(cleaned)
  })

  return normalized
}

const sanitizeDefenseList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const normalized: string[] = []

  value.forEach((entry) => {
    if (typeof entry !== 'string') {
      return
    }
    const cleaned = entry.trim()
    if (!cleaned) {
      return
    }
    const key = cleaned.toLowerCase()
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    normalized.push(cleaned)
  })

  return normalized
}

/**
 * Converts untrusted campaign character data into a safe template entry.
 */
const sanitizeCharacter = (character: unknown): CampaignCharacter | null => {
  if (!character || typeof character !== 'object') {
    return null
  }

  const candidate = character as Partial<CampaignCharacter>
  const name = sanitizeName(candidate.name)
  const maxHpValue = Number.parseInt(String(candidate.maxHp ?? ''), 10)
  const maxHp = Number.isFinite(maxHpValue) ? Math.max(1, Math.trunc(maxHpValue)) : null

  if (!name || maxHp === null) {
    return null
  }

  const armorClassValue = Number.parseInt(String(candidate.armorClass ?? ''), 10)
  const createdAtValue = Number.parseInt(String(candidate.createdAt ?? ''), 10)

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : nanoid(),
    name,
    maxHp,
    armorClass: Number.isFinite(armorClassValue) ? Math.max(0, Math.trunc(armorClassValue)) : null,
    profileUrl: sanitizeProfileUrl(candidate.profileUrl),
    notes: typeof candidate.notes === 'string' ? candidate.notes : '',
    tags: sanitizeTagList(candidate.tags),
    damageImmunities: sanitizeDefenseList((candidate as { damageImmunities?: unknown }).damageImmunities),
    damageResistances: sanitizeDefenseList((candidate as { damageResistances?: unknown }).damageResistances),
    damageVulnerabilities: sanitizeDefenseList(
      (candidate as { damageVulnerabilities?: unknown }).damageVulnerabilities,
    ),
    createdAt: Number.isFinite(createdAtValue) ? createdAtValue : Date.now(),
  }
}

/**
 * Converts untrusted campaign data into the sanitized shape stored in Redux.
 */
const sanitizeCampaign = (campaign: unknown): Campaign | null => {
  if (!campaign || typeof campaign !== 'object') {
    return null
  }

  const candidate = campaign as Partial<Campaign>
  const name = sanitizeName(candidate.name)
  if (!name) {
    return null
  }

  const createdAtValue = Number.parseInt(String(candidate.createdAt ?? ''), 10)
  const notes = sanitizeNotes(candidate.notes)
  const playerCharacters = Array.isArray(candidate.playerCharacters)
    ? (candidate.playerCharacters.map(sanitizeCharacter).filter(Boolean) as CampaignCharacter[])
    : []

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : nanoid(),
    name,
    notes,
    createdAt: Number.isFinite(createdAtValue) ? createdAtValue : Date.now(),
    playerCharacters,
  }
}

const initialState: CampaignState = {
  campaigns: [],
  activeCampaignId: null,
}

export interface CreateCampaignArgs {
  name: string
}

export interface SetActiveCampaignArgs {
  campaignId: string
}

export interface UpdateCampaignDetailsArgs {
  id: string
  name: string
  notes: string
}

export interface AddPlayerCharacterArgs {
  campaignId: string
  character: Omit<CampaignCharacter, 'id' | 'createdAt'>
}

export interface RemovePlayerCharacterArgs {
  campaignId: string
  characterId: string
}

export interface UpdatePlayerCharacterArgs {
  campaignId: string
  characterId: string
  character: {
    name: string
    maxHp: number
    armorClass: number | null
    profileUrl: string
    notes: string
    tags: string[]
    damageImmunities: string[]
    damageResistances: string[]
    damageVulnerabilities: string[]
  }
}

export interface LoadCampaignStateArgs {
  campaigns?: unknown
  activeCampaignId?: unknown
}

const campaignsSlice = createSlice({
  name: 'campaigns',
  initialState,
  reducers: {
    /**
     * Creates a new campaign and makes it the active selection.
     */
    createCampaign: {
      prepare({ name }: CreateCampaignArgs) {
        const sanitizedName = sanitizeName(name)
        return {
          payload: {
            id: nanoid(),
            name: sanitizedName || 'Untitled campaign',
            notes: '',
            createdAt: Date.now(),
            playerCharacters: [] as CampaignCharacter[],
          },
        }
      },
      reducer(state, action: PayloadAction<Campaign>) {
        state.campaigns.push(action.payload)
        state.activeCampaignId = action.payload.id
      },
    },
    /**
     * Sets the currently active campaign when the provided ID exists.
     */
    setActiveCampaign(state, action: PayloadAction<string>) {
      const campaignId = action.payload
      const exists = state.campaigns.some((campaign) => campaign.id === campaignId)
      if (exists) {
        state.activeCampaignId = campaignId
      }
    },
    /**
     * Removes a campaign and selects the next available campaign if needed.
     */
    removeCampaign(state, action: PayloadAction<string>) {
      const campaignId = action.payload
      state.campaigns = state.campaigns.filter((campaign) => campaign.id !== campaignId)
      if (state.activeCampaignId === campaignId) {
        state.activeCampaignId = state.campaigns.length > 0 ? state.campaigns[0].id : null
      }
    },
    /**
     * Updates a campaign's name or notes without affecting other fields.
     */
    updateCampaignDetails(state, action: PayloadAction<UpdateCampaignDetailsArgs>) {
      const { id, name, notes } = action.payload
      const campaign = state.campaigns.find((entry) => entry.id === id)
      if (!campaign) {
        return
      }

      const sanitizedName = sanitizeName(name)
      if (sanitizedName) {
        campaign.name = sanitizedName
      }

      if (typeof notes === 'string') {
        campaign.notes = notes
      }
    },
    /**
     * Adds a character template to a campaign's roster.
     */
    addPlayerCharacter: {
      prepare({ campaignId, character }: AddPlayerCharacterArgs) {
        return {
          payload: {
            campaignId,
            character: {
              id: nanoid(),
              name: character.name,
              maxHp: character.maxHp,
              armorClass: character.armorClass,
              profileUrl: sanitizeProfileUrl(character.profileUrl),
              notes: character.notes,
              tags: sanitizeTagList(character.tags),
              damageImmunities: sanitizeDefenseList(character.damageImmunities),
              damageResistances: sanitizeDefenseList(character.damageResistances),
              damageVulnerabilities: sanitizeDefenseList(character.damageVulnerabilities),
              createdAt: Date.now(),
            } satisfies CampaignCharacter,
          },
        }
      },
      reducer(state, action: PayloadAction<{ campaignId: string; character: CampaignCharacter }>) {
        const { campaignId, character } = action.payload
        const campaign = state.campaigns.find((entry) => entry.id === campaignId)
        if (!campaign) {
          return
        }
        campaign.playerCharacters.push(character)
      },
    },
    /**
     * Removes a character template from the specified campaign.
     */
    removePlayerCharacter(state, action: PayloadAction<RemovePlayerCharacterArgs>) {
      const { campaignId, characterId } = action.payload
      const campaign = state.campaigns.find((entry) => entry.id === campaignId)
      if (!campaign) {
        return
      }
      campaign.playerCharacters = campaign.playerCharacters.filter(
        (character) => character.id !== characterId,
      )
    },
    /**
     * Updates an existing player character template with sanitized values.
     */
    updatePlayerCharacter(state, action: PayloadAction<UpdatePlayerCharacterArgs>) {
      const { campaignId, characterId, character } = action.payload
      const campaign = state.campaigns.find((entry) => entry.id === campaignId)
      if (!campaign) {
        return
      }

      const existing = campaign.playerCharacters.find((entry) => entry.id === characterId)
      if (!existing) {
        return
      }

      const sanitizedName = sanitizeName(character.name)
      if (!sanitizedName) {
        return
      }

      const maxHpValue = Number.parseInt(String(character.maxHp ?? ''), 10)
      if (!Number.isFinite(maxHpValue) || maxHpValue <= 0) {
        return
      }

      const armorClassValue = Number.parseInt(String(character.armorClass ?? ''), 10)

      existing.name = sanitizedName
      existing.maxHp = Math.trunc(maxHpValue)
      existing.armorClass = Number.isFinite(armorClassValue)
        ? Math.max(0, Math.trunc(armorClassValue))
        : null
      existing.profileUrl = sanitizeProfileUrl(character.profileUrl)
      existing.notes = typeof character.notes === 'string' ? character.notes : ''
      existing.tags = sanitizeTagList(character.tags)
      existing.damageImmunities = sanitizeDefenseList(character.damageImmunities)
      existing.damageResistances = sanitizeDefenseList(character.damageResistances)
      existing.damageVulnerabilities = sanitizeDefenseList(character.damageVulnerabilities)
    },
    /**
     * Loads campaign state exported from disk and sanitizes the payload.
     */
    loadState(state, action: PayloadAction<LoadCampaignStateArgs>) {
      const { campaigns, activeCampaignId } = action.payload

      const sanitizedCampaigns = Array.isArray(campaigns)
        ? (campaigns.map(sanitizeCampaign).filter(Boolean) as Campaign[])
        : []

      state.campaigns = sanitizedCampaigns

      if (typeof activeCampaignId === 'string') {
        const exists = sanitizedCampaigns.some((campaign) => campaign.id === activeCampaignId)
        state.activeCampaignId = exists
          ? activeCampaignId
          : sanitizedCampaigns.length > 0
            ? sanitizedCampaigns[0].id
            : null
      } else {
        state.activeCampaignId = sanitizedCampaigns.length > 0 ? sanitizedCampaigns[0].id : null
      }
    },
  },
})

export const {
  createCampaign,
  setActiveCampaign,
  removeCampaign,
  updateCampaignDetails,
  addPlayerCharacter,
  removePlayerCharacter,
  updatePlayerCharacter,
  loadState,
} = campaignsSlice.actions

export default campaignsSlice.reducer

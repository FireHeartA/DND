import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit'
import type { Campaign, CampaignCharacter, CampaignState, QuestEntry, SessionLogEntry, TreasureItem, TreasureList } from '../types'

/**
 * Trims a string and ensures it is safe to store
 */
const sanitizeString = (value: unknown): string => {
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
  const name = sanitizeString(candidate.name)
  const maxHpValue = Number.parseInt(String(candidate.maxHp ?? ''), 10)
  const maxHp = Number.isFinite(maxHpValue) ? Math.max(1, Math.trunc(maxHpValue)) : null

  if (!name || maxHp === null) {
    return null
  }

  const armorClassValue = Number.parseInt(String(candidate.armorClass ?? ''), 10)
  const playerLevelValue = Number.parseInt(String(candidate.playerLevel ?? ''), 10)
  const createdAtValue = Number.parseInt(String(candidate.createdAt ?? ''), 10)

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : nanoid(),
    name,
    maxHp,
    armorClass: Number.isFinite(armorClassValue) ? Math.max(0, Math.trunc(armorClassValue)) : null,
    playerLevel: Number.isFinite(playerLevelValue) ? Math.max(1, Math.trunc(playerLevelValue)) : null,
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
const sanitizeSessionLog = (entry: unknown): SessionLogEntry | null => {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const candidate = entry as Partial<SessionLogEntry>
  const session = sanitizeString(candidate.session)
  const summary = sanitizeString(candidate.summary)

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : nanoid(),
    session,
    summary,
  }
}

const sanitizeQuestEntry = (entry: unknown): QuestEntry | null => {
  if (!entry || typeof entry !== 'object') {
    return null
  }
    const candidate = entry as Partial<QuestEntry>
  const title = sanitizeString(candidate.title)
  const text = sanitizeString(candidate.text)
  // defaults to pending if invalid or missing
  const status = candidate.status === 'pending' || candidate.status === 'completed' || candidate.status === 'failed' ? candidate.status : 'pending'
  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : nanoid(),
    title,
    text,
    status,
  }
}

const sanitizeTreasureItem = (item: unknown): TreasureItem | null => {
  if (!item || typeof item !== 'object') {
    return null
  }

  const candidate = item as Partial<TreasureItem>
  const treasure = sanitizeString(candidate.treasure)
  const location = sanitizeString(candidate.location)
  const goldValue = sanitizeString(candidate.goldValue)

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : nanoid(),
    isClaimed: typeof candidate.isClaimed === 'boolean' ? candidate.isClaimed : false,
    treasure,
    location,
    goldValue,
  }
}

const sanitizeTreasureLists = (list: unknown): TreasureList | null => {
  if (!list || typeof list !== 'object') {
    return null
  }

  const candidate = list as Partial<TreasureList>
  const header = sanitizeString(candidate.header)
  const items = Array.isArray(candidate.items) ? candidate.items.map(sanitizeTreasureItem).filter(Boolean) as TreasureItem[] : []

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : nanoid(),
    header,
    items,
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
  const name = sanitizeString(candidate.name)
  if (!name) {
    return null
  }

  const createdAtValue = Number.parseInt(String(candidate.createdAt ?? ''), 10)
  const notes = sanitizeString(candidate.notes)
  const playerCharacters = Array.isArray(candidate.playerCharacters)
    ? (candidate.playerCharacters.map(sanitizeCharacter).filter(Boolean) as CampaignCharacter[])
    : []
  const sessionLogs = Array.isArray(candidate.sessionLogs) ? candidate.sessionLogs.map(sanitizeSessionLog).filter(Boolean) as SessionLogEntry[] : [];
  const questEntries = Array.isArray(candidate.questEntries) ? candidate.questEntries.map(sanitizeQuestEntry).filter(Boolean) as QuestEntry[] : [];
  const treasureLists = Array.isArray(candidate.treasureLists) ? candidate.treasureLists.map(sanitizeTreasureLists).filter(Boolean) as TreasureList[] : [];

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : nanoid(),
    name,
    notes,
    createdAt: Number.isFinite(createdAtValue) ? createdAtValue : Date.now(),
    playerCharacters,
    sessionLogs,
    questEntries,
    treasureLists,
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
export interface UpdateCampaignSessionLogsArgs {
  id: string
  sessionLogs: SessionLogEntry[],
}
export interface UpdateCampaignQuestEntriesArgs {
  id: string
  questEntries: QuestEntry[],
}
export interface UpdateCampaignTreasureListsArgs {
  id: string
  treasureLists: TreasureList[],
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
    playerLevel: number | null
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
        const sanitizedName = sanitizeString(name)
        return {
          payload: {
            id: nanoid(),
            name: sanitizedName || 'Untitled campaign',
            notes: '',
            createdAt: Date.now(),
            playerCharacters: [] as CampaignCharacter[],
            sessionLogs: [] as SessionLogEntry[],
            treasureLists: [] as TreasureList[],
            questEntries: [] as QuestEntry[],
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

      const sanitizedName = sanitizeString(name)
      if (sanitizedName) {
        campaign.name = sanitizedName
      }
      const sanitizedNotes = sanitizeString(notes)
      if (sanitizedNotes) {
        campaign.notes = sanitizedNotes
      }
    },
    
    /**
     * Updates a campaign's sessionLogs without affecting other fields.
     */
    updateCampaignSessionLogs(state, action: PayloadAction<UpdateCampaignSessionLogsArgs>) {
      const { id, sessionLogs } = action.payload
      const campaign = state.campaigns.find((entry) => entry.id === id)
      if (!campaign) {
        return
      }

      const sanitizedSessionLogs = Array.isArray(sessionLogs) ? sessionLogs.map(sanitizeSessionLog).filter(Boolean) as SessionLogEntry[] : null;
      if (sanitizedSessionLogs) {
        campaign.sessionLogs = sanitizedSessionLogs
      }
    },
    /**
     * Updates a campaign's questEntries without affecting other fields.
     */
    updateCampaignQuestEntries(state, action: PayloadAction<UpdateCampaignQuestEntriesArgs>) {
      const { id, questEntries } = action.payload
      const campaign = state.campaigns.find((entry) => entry.id === id) 
      ;
      if (!campaign) {
        return
      }
      const sanitizedQuestEntries = Array.isArray(questEntries) ? questEntries.map(sanitizeQuestEntry).filter(Boolean) as QuestEntry[] : null;
      if (sanitizedQuestEntries) {
        campaign.questEntries = sanitizedQuestEntries
      }
    },

    /**
     * Updates a campaign's treasureLists without affecting other fields.
     */
    updateCampaignTreasureLists(state, action: PayloadAction<UpdateCampaignTreasureListsArgs>) {
      const { id, treasureLists } = action.payload
      const campaign = state.campaigns.find((entry) => entry.id === id)
      if (!campaign) {
        return
      }
      const sanitizedTreasureLists = Array.isArray(treasureLists) ? treasureLists.map(sanitizeTreasureLists).filter(Boolean) as TreasureList[] : null;
      if (sanitizedTreasureLists) {
        campaign.treasureLists = sanitizedTreasureLists
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
              playerLevel: character.playerLevel ?? null,
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

      const sanitizedName = sanitizeString(character.name)
      if (!sanitizedName) {
        return
      }

      const maxHpValue = Number.parseInt(String(character.maxHp ?? ''), 10)
      if (!Number.isFinite(maxHpValue) || maxHpValue <= 0) {
        return
      }

      const armorClassValue = Number.parseInt(String(character.armorClass ?? ''), 10)
      const playerLevelValue = Number.parseInt(String(character.playerLevel ?? ''), 10)

      existing.name = sanitizedName
      existing.maxHp = Math.trunc(maxHpValue)
      existing.armorClass = Number.isFinite(armorClassValue)
        ? Math.max(0, Math.trunc(armorClassValue))
        : null
      existing.playerLevel = Number.isFinite(playerLevelValue)
        ? Math.max(1, Math.trunc(playerLevelValue))
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
  updateCampaignSessionLogs,
  updateCampaignQuestEntries,
  updateCampaignTreasureLists,
  addPlayerCharacter,
  removePlayerCharacter,
  updatePlayerCharacter,
  loadState,
} = campaignsSlice.actions

export default campaignsSlice.reducer

import { createSlice, nanoid } from '@reduxjs/toolkit'

const initialState = {
  campaigns: [],
  activeCampaignId: null,
}

const sanitizeName = (value) => {
  if (typeof value !== 'string') {
    return ''
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ''
}

const sanitizeNotes = (value) => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

const sanitizeCharacter = (character) => {
  if (!character || typeof character !== 'object') {
    return null
  }

  const name = sanitizeName(character.name)
  const maxHpValue = Number.parseInt(character.maxHp, 10)
  const maxHp = Number.isFinite(maxHpValue) ? Math.max(1, Math.trunc(maxHpValue)) : null

  if (!name || maxHp === null) {
    return null
  }

  const armorClassValue = Number.parseInt(character.armorClass, 10)
  const createdAtValue = Number.parseInt(character.createdAt, 10)

  return {
    id:
      typeof character.id === 'string' && character.id.length > 0
        ? character.id
        : nanoid(),
    name,
    maxHp,
    armorClass: Number.isFinite(armorClassValue)
      ? Math.max(0, Math.trunc(armorClassValue))
      : null,
    notes: typeof character.notes === 'string' ? character.notes : '',
    createdAt: Number.isFinite(createdAtValue) ? createdAtValue : Date.now(),
  }
}

const sanitizeCampaign = (campaign) => {
  if (!campaign || typeof campaign !== 'object') {
    return null
  }

  const name = sanitizeName(campaign.name)
  if (!name) {
    return null
  }

  const createdAtValue = Number.parseInt(campaign.createdAt, 10)
  const notes = sanitizeNotes(campaign.notes)

  const playerCharacters = Array.isArray(campaign.playerCharacters)
    ? campaign.playerCharacters.map(sanitizeCharacter).filter(Boolean)
    : []

  return {
    id:
      typeof campaign.id === 'string' && campaign.id.length > 0
        ? campaign.id
        : nanoid(),
    name,
    notes,
    createdAt: Number.isFinite(createdAtValue) ? createdAtValue : Date.now(),
    playerCharacters,
  }
}

const campaignsSlice = createSlice({
  name: 'campaigns',
  initialState,
  reducers: {
    createCampaign: {
      prepare({ name }) {
        const sanitizedName = sanitizeName(name)
        return {
          payload: {
            id: nanoid(),
            name: sanitizedName || 'Untitled campaign',
            notes: '',
            createdAt: Date.now(),
            playerCharacters: [],
          },
        }
      },
      reducer(state, action) {
        state.campaigns.push(action.payload)
        state.activeCampaignId = action.payload.id
      },
    },
    setActiveCampaign(state, action) {
      const campaignId = action.payload
      const exists = state.campaigns.some((campaign) => campaign.id === campaignId)
      if (exists) {
        state.activeCampaignId = campaignId
      }
    },
    removeCampaign(state, action) {
      const campaignId = action.payload
      state.campaigns = state.campaigns.filter((campaign) => campaign.id !== campaignId)
      if (state.activeCampaignId === campaignId) {
        state.activeCampaignId = state.campaigns.length > 0 ? state.campaigns[0].id : null
      }
    },
    updateCampaignDetails(state, action) {
      const { id, name, notes } = action.payload || {}
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
    addPlayerCharacter: {
      prepare({ campaignId, name, maxHp, armorClass = null, notes = '' }) {
        return {
          payload: {
            campaignId,
            character: {
              id: nanoid(),
              name,
              maxHp,
              armorClass,
              notes,
              createdAt: Date.now(),
            },
          },
        }
      },
      reducer(state, action) {
        const { campaignId, character } = action.payload
        const campaign = state.campaigns.find((entry) => entry.id === campaignId)
        if (!campaign) {
          return
        }
        campaign.playerCharacters.push(character)
      },
    },
    removePlayerCharacter(state, action) {
      const { campaignId, characterId } = action.payload || {}
      const campaign = state.campaigns.find((entry) => entry.id === campaignId)
      if (!campaign) {
        return
      }
      campaign.playerCharacters = campaign.playerCharacters.filter(
        (character) => character.id !== characterId,
      )
    },
    loadState(state, action) {
      const { campaigns, activeCampaignId } = action.payload || {}
      if (!Array.isArray(campaigns)) {
        state.campaigns = []
        state.activeCampaignId = null
        return
      }

      const sanitizedCampaigns = campaigns.map(sanitizeCampaign).filter(Boolean)
      state.campaigns = sanitizedCampaigns

      if (typeof activeCampaignId === 'string') {
        const exists = sanitizedCampaigns.some(
          (campaign) => campaign.id === activeCampaignId,
        )
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
  loadState,
} = campaignsSlice.actions

export default campaignsSlice.reducer

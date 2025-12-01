import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  addPlayerCharacter as addPlayerCharacterAction,
  createCampaign as createCampaignAction,
  removeCampaign as removeCampaignAction,
  removePlayerCharacter as removePlayerCharacterAction,
  setActiveCampaign as setActiveCampaignAction,
  updateCampaignDetails as updateCampaignDetailsAction,
  updatePlayerCharacter as updatePlayerCharacterAction,
} from '../../store/campaignSlice'
import {
  importMonster as importMonsterAction,
  removeMonsterFromCampaign as removeMonsterFromCampaignAction,
  toggleMonsterFavorite as toggleMonsterFavoriteAction,
  updateMonsterDetails as updateMonsterDetailsAction,
} from '../../store/monsterLibrarySlice'
import { normalizeDndBeyondUrl, parseDndBeyondMonster } from '../../utils/dndBeyondMonsterParser'
import {
  getMonsterDisplayTags,
  normalizeMonsterTag,
  prepareMonsterTags,
} from '../../utils/monsterTags'
import {
  DEFENSE_OPTION_LOOKUP,
  MONSTER_DEFENSE_OPTIONS,
  getDefenseChipStyle,
  isDefenseTag,
  parseDefenseList,
} from '../../utils/monsterDefenses'
import type {
  Campaign,
  CampaignCharacter,
  MonsterDetails,
  MonsterLibraryEntry,
  MonsterLibraryState,
  RootState,
} from '../../types'
import type { AppDispatch } from '../../store'

interface MonsterEditDraft {
  name: string
  description: string
  armorClass: string
  hitPoints: string
  challengeRating: string
  damageImmunities: string[]
  damageResistances: string[]
  damageVulnerabilities: string[]
  tags: string[]
  tagDraft: string
  error: string
}

interface PlayerTemplateEditDraft {
  name: string
  maxHp: string
  armorClass: string
  profileUrl: string
  notes: string
  error: string
}

const stringifyDefenseList = (values: string[]): string => {
  if (!Array.isArray(values)) {
    return ''
  }

  return values
    .map((value) => {
      const option = DEFENSE_OPTION_LOOKUP[value]
      return option ? option.label : value
    })
    .filter(Boolean)
    .join(', ')
}

/**
 * Displays the campaign manager view, allowing the user to manage rosters and monsters.
 */
export const CampaignManagerView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const campaigns = useSelector((state: RootState) => state.campaigns.campaigns)
  const activeCampaignId = useSelector((state: RootState) => state.campaigns.activeCampaignId)
  const monsterLibrary = useSelector((state: RootState) => state.monsterLibrary)

  const [campaignForm, setCampaignForm] = useState({ name: '' })
  const [campaignFormError, setCampaignFormError] = useState('')
  const [campaignDetailsDraft, setCampaignDetailsDraft] = useState({ name: '', notes: '' })
  const [campaignDetailsError, setCampaignDetailsError] = useState('')
  const [playerTemplateForm, setPlayerTemplateForm] = useState({
    name: '',
    maxHp: '',
    armorClass: '',
    profileUrl: '',
    notes: '',
  })
  const [playerTemplateError, setPlayerTemplateError] = useState('')
  const [monsterImportUrl, setMonsterImportUrl] = useState('')
  const [monsterImportError, setMonsterImportError] = useState('')
  const [monsterImportSuccess, setMonsterImportSuccess] = useState('')
  const [isMonsterImporting, setIsMonsterImporting] = useState(false)
  const [monsterEdits, setMonsterEdits] = useState<Record<string, MonsterEditDraft>>({})
  const [playerTemplateEdits, setPlayerTemplateEdits] = useState<
    Record<string, PlayerTemplateEditDraft>
  >({})
  const [isCampaignDetailsCollapsed, setIsCampaignDetailsCollapsed] = useState(false)
  const [isPlayerFormCollapsed, setIsPlayerFormCollapsed] = useState(false)
  const [isRosterCollapsed, setIsRosterCollapsed] = useState(false)
  const [isMonstersCollapsed, setIsMonstersCollapsed] = useState(false)

  const damageDefenseOptions = useMemo(
    () => MONSTER_DEFENSE_OPTIONS.filter((option) => option.category === 'damage'),
    [],
  )
  const conditionDefenseOptions = useMemo(
    () => MONSTER_DEFENSE_OPTIONS.filter((option) => option.category === 'condition'),
    [],
  )

  /**
   * Sorts campaigns chronologically so the list remains stable for learners.
   */
  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => a.createdAt - b.createdAt)
  }, [campaigns])

  /**
   * Finds the currently selected campaign from the Redux store.
   */
  const activeCampaign = useMemo<Campaign | null>(() => {
    return campaigns.find((campaign) => campaign.id === activeCampaignId) || null
  }, [campaigns, activeCampaignId])

  /**
   * Orders the active campaign roster by creation time for predictable display.
   */
  const activeCampaignRoster = useMemo<CampaignCharacter[]>(() => {
    if (!activeCampaign) {
      return []
    }
    return [...activeCampaign.playerCharacters].sort((a, b) => a.createdAt - b.createdAt)
  }, [activeCampaign])

  /**
   * Derives the monsters linked to the active campaign.
   */
  const campaignMonsterList = useMemo(() => {
    if (!activeCampaign) {
      return [] as Array<{
        monster: MonsterDetails
        entry: MonsterLibraryEntry
        isFavorite: boolean
      }>
    }

    const libraryEntries = monsterLibrary.campaignLibraries[activeCampaign.id] || []
    const favorites = new Set(monsterLibrary.favorites)

    return libraryEntries
      .map((entry) => {
        const monster = monsterLibrary.monsters[entry.monsterId]
        if (!monster) {
          return null
        }
        return {
          monster,
          entry,
          isFavorite: favorites.has(entry.monsterId),
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const lastA = a!.entry.lastUsedAt || 0
        const lastB = b!.entry.lastUsedAt || 0

        if (lastA !== lastB) {
          return lastB - lastA
        }

        if (a!.entry.usageCount !== b!.entry.usageCount) {
          return b!.entry.usageCount - a!.entry.usageCount
        }

        return b!.entry.addedAt - a!.entry.addedAt
      }) as Array<{
      monster: MonsterDetails
      entry: MonsterLibraryEntry
      isFavorite: boolean
    }>
  }, [activeCampaign, monsterLibrary])

  /**
   * Updates the campaign details draft whenever the active campaign changes.
   */
  useEffect(() => {
    if (!activeCampaign) {
      setCampaignDetailsDraft({ name: '', notes: '' })
      setCampaignDetailsError('')
      return
    }
    setCampaignDetailsDraft({
      name: activeCampaign.name,
      notes: activeCampaign.notes || '',
    })
    setCampaignDetailsError('')
  }, [activeCampaign])

  /**
   * Clears monster import feedback when the user selects a different campaign.
   */
  useEffect(() => {
    setMonsterImportError('')
    setMonsterImportSuccess('')
    setMonsterImportUrl('')
  }, [activeCampaignId])

  /**
   * Clears any in-progress player template edits when switching campaigns.
   */
  useEffect(() => {
    setPlayerTemplateEdits({})
  }, [activeCampaignId])

  /**
   * Handles updates to the new campaign form fields.
   */
  const handleCampaignFormChange = useCallback((value: string) => {
    setCampaignForm((prev) => ({
      ...prev,
      name: value,
    }))
  }, [])

  /**
   * Submits the campaign creation form and resets the input.
   */
  const handleCreateCampaign = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const name = campaignForm.name.trim()

      if (!name) {
        setCampaignFormError('Name your campaign to begin planning your adventures.')
        return
      }

      dispatch(createCampaignAction({ name }))
      setCampaignForm({ name: '' })
      setCampaignFormError('')
    },
    [campaignForm.name, dispatch],
  )

  /**
   * Switches the active campaign when the user selects a different entry.
   */
  const handleSelectCampaign = useCallback(
    (campaignId: string) => {
      dispatch(setActiveCampaignAction(campaignId))
      setPlayerTemplateError('')
    },
    [dispatch],
  )

  /**
   * Removes a campaign and any associated local errors.
   */
  const handleRemoveCampaign = useCallback(
    (campaignId: string) => {
      dispatch(removeCampaignAction(campaignId))
    },
    [dispatch],
  )

  /**
   * Updates the draft values for the active campaign details form.
   */
  const handleCampaignDetailsChange = useCallback((field: 'name' | 'notes', value: string) => {
    setCampaignDetailsDraft((prev) => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  /**
   * Saves the edited campaign details to Redux.
   */
  const handleSaveCampaignDetails = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!activeCampaign) {
        return
      }

      const name = campaignDetailsDraft.name.trim()

      if (!name) {
        setCampaignDetailsError('A campaign needs a name worthy of the saga.')
        return
      }

      dispatch(
        updateCampaignDetailsAction({
          id: activeCampaign.id,
          name,
          notes: campaignDetailsDraft.notes,
        }),
      )

      setCampaignDetailsError('')
    },
    [activeCampaign, campaignDetailsDraft, dispatch],
  )

  /**
   * Handles updates to the roster form inputs.
   */
  const handlePlayerTemplateFormChange = useCallback(
    (field: 'name' | 'maxHp' | 'armorClass' | 'profileUrl' | 'notes', value: string) => {
      setPlayerTemplateForm((prev) => ({
        ...prev,
        [field]: value,
      }))
    },
    [],
  )

  /**
   * Clears the roster form fields.
   */
  const resetPlayerTemplateForm = useCallback(() => {
    setPlayerTemplateForm({
      name: '',
      maxHp: '',
      armorClass: '',
      profileUrl: '',
      notes: '',
    })
  }, [])

  /**
   * Adds a player template to the active campaign after validating input.
   */
  const handleAddPlayerTemplate = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!activeCampaignId) {
        setPlayerTemplateError('Select a campaign before saving a hero template.')
        return
      }

      const name = playerTemplateForm.name.trim()
      if (!name) {
        setPlayerTemplateError('Every hero needs a name before they join the roster.')
        return
      }

      const maxHpValue = Number.parseInt(playerTemplateForm.maxHp, 10)
      if (!Number.isFinite(maxHpValue) || maxHpValue <= 0) {
        setPlayerTemplateError('Max HP must be a positive number for your heroes.')
        return
      }

      const armorClassValue = Number.parseInt(playerTemplateForm.armorClass, 10)
      const armorClass = Number.isFinite(armorClassValue)
        ? Math.max(0, Math.trunc(armorClassValue))
        : null

      const profileUrl = playerTemplateForm.profileUrl.trim()
      if (profileUrl && !/^https?:\/\//i.test(profileUrl)) {
        setPlayerTemplateError('Profile links should start with http:// or https:// to open correctly.')
        return
      }

      dispatch(
        addPlayerCharacterAction({
          campaignId: activeCampaignId,
          character: {
            name,
            maxHp: Math.trunc(maxHpValue),
            armorClass,
            profileUrl,
            notes: playerTemplateForm.notes,
          },
        }),
      )

      setPlayerTemplateError('')
      resetPlayerTemplateForm()
    },
    [
      activeCampaignId,
      dispatch,
      playerTemplateForm.armorClass,
      playerTemplateForm.maxHp,
      playerTemplateForm.name,
      playerTemplateForm.notes,
      playerTemplateForm.profileUrl,
      resetPlayerTemplateForm,
    ],
  )

  /**
   * Removes a player template from the active campaign roster.
   */
  const handleRemovePlayerTemplate = useCallback(
    (id: string) => {
      if (!activeCampaignId) {
        return
      }
      setPlayerTemplateEdits((prev) => {
        if (!(id in prev)) {
          return prev
        }
        const next = { ...prev }
        delete next[id]
        return next
      })
      dispatch(
        removePlayerCharacterAction({
          campaignId: activeCampaignId,
          characterId: id,
        }),
      )
    },
    [activeCampaignId, dispatch],
  )

  /**
   * Begins editing a saved player template by copying its current data into local state.
   */
  const handleStartPlayerTemplateEdit = useCallback((template: CampaignCharacter) => {
    setPlayerTemplateEdits((prev) => ({
      ...prev,
      [template.id]: {
        name: template.name,
        maxHp: String(template.maxHp),
        armorClass: template.armorClass !== null ? String(template.armorClass) : '',
        profileUrl: template.profileUrl || '',
        notes: template.notes || '',
        error: '',
      },
    }))
  }, [])

  /**
   * Discards edits for a saved player template.
   */
  const handleCancelPlayerTemplateEdit = useCallback((id: string) => {
    setPlayerTemplateEdits((prev) => {
      if (!(id in prev)) {
        return prev
      }
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  /**
   * Updates a field in the saved player template edit draft.
   */
  const handlePlayerTemplateEditFieldChange = useCallback(
    (
      id: string,
      field: 'name' | 'maxHp' | 'armorClass' | 'profileUrl' | 'notes',
      value: string,
    ) => {
      setPlayerTemplateEdits((prev) => {
        const draft = prev[id]
        if (!draft) {
          return prev
        }
        return {
          ...prev,
          [id]: {
            ...draft,
            [field]: value,
            error: '',
          },
        }
      })
    },
    [],
  )

  /**
   * Saves the edits for a player template after validating the draft values.
   */
  const handleSavePlayerTemplateEdit = useCallback(
    (id: string) => {
      if (!activeCampaignId) {
        return
      }

      const draft = playerTemplateEdits[id]
      if (!draft) {
        return
      }

      const name = draft.name.trim()
      if (!name) {
        setPlayerTemplateEdits((prev) => {
          const existing = prev[id]
          if (!existing) {
            return prev
          }
          return {
            ...prev,
            [id]: {
              ...existing,
              error: 'Every hero needs a name before they join the roster.',
            },
          }
        })
        return
      }

      const maxHpValue = Number.parseInt(draft.maxHp, 10)
      if (!Number.isFinite(maxHpValue) || maxHpValue <= 0) {
        setPlayerTemplateEdits((prev) => {
          const existing = prev[id]
          if (!existing) {
            return prev
          }
          return {
            ...prev,
            [id]: {
              ...existing,
              error: 'Max HP must be a positive number for your heroes.',
            },
          }
        })
        return
      }

      const armorClassValue = Number.parseInt(draft.armorClass, 10)
      const armorClass = Number.isFinite(armorClassValue)
        ? Math.max(0, Math.trunc(armorClassValue))
        : null

      const profileUrl = draft.profileUrl.trim()
      if (profileUrl && !/^https?:\/\//i.test(profileUrl)) {
        setPlayerTemplateEdits((prev) => {
          const existing = prev[id]
          if (!existing) {
            return prev
          }
          return {
            ...prev,
            [id]: {
              ...existing,
              error: 'Profile links should start with http:// or https:// to open correctly.',
            },
          }
        })
        return
      }

      dispatch(
        updatePlayerCharacterAction({
          campaignId: activeCampaignId,
          characterId: id,
          character: {
            name,
            maxHp: Math.trunc(maxHpValue),
            armorClass,
            profileUrl,
            notes: draft.notes,
          },
        }),
      )

      setPlayerTemplateEdits((prev) => {
        if (!(id in prev)) {
          return prev
        }
        const next = { ...prev }
        delete next[id]
        return next
      })
    },
    [activeCampaignId, dispatch, playerTemplateEdits],
  )

  /**
   * Starts editing a monster by capturing its current details into local state.
   */
  const handleStartMonsterEdit = useCallback((monster: MonsterDetails) => {
    if (!monster || !monster.id) {
      return
    }
    setMonsterEdits((prev) => ({
      ...prev,
      [monster.id]: {
        name: monster.name || '',
        description:
          Array.isArray(monster.description) && monster.description.length > 0
            ? monster.description.join('\n\n')
            : '',
        armorClass: monster.armorClass !== null ? String(monster.armorClass) : '',
        hitPoints: monster.hitPoints !== null ? String(monster.hitPoints) : '',
        challengeRating: monster.challengeRating || '',
        damageImmunities: parseDefenseList(monster.damageImmunities),
        damageResistances: parseDefenseList(monster.damageResistances),
        damageVulnerabilities: parseDefenseList(monster.damageVulnerabilities),
        tags: getMonsterDisplayTags(monster),
        tagDraft: '',
        error: '',
      },
    }))
  }, [])

  /**
   * Cancels editing for a monster and discards local changes.
   */
  const handleCancelMonsterEdit = useCallback((monsterId: string) => {
    setMonsterEdits((prev) => {
      if (!(monsterId in prev)) {
        return prev
      }
      const next = { ...prev }
      delete next[monsterId]
      return next
    })
  }, [])

  /**
   * Updates a field within the in-progress monster edit draft.
   */
  const handleMonsterEditFieldChange = useCallback(
    (monsterId: string, field: keyof MonsterEditDraft, value: string | string[]) => {
      setMonsterEdits((prev) => {
        const existing = prev[monsterId]
        if (!existing) {
          return prev
        }
        return {
          ...prev,
          [monsterId]: {
            ...existing,
            [field]: value,
            error: '',
          },
        }
      })
    },
    [],
  )

  const handleMonsterDefenseAdd = useCallback(
    (
      monsterId: string,
      field: 'damageImmunities' | 'damageResistances' | 'damageVulnerabilities',
      value: string,
    ) => {
      const trimmed = value.trim()
      if (!trimmed) {
        return
      }

      const option = MONSTER_DEFENSE_OPTIONS.find((candidate) => candidate.value === trimmed)
      if (!option) {
        return
      }

      setMonsterEdits((prev) => {
        const existing = prev[monsterId]
        if (!existing) {
          return prev
        }

        const currentValues = Array.isArray(existing[field]) ? existing[field] : []

        if (currentValues.includes(option.value)) {
          return prev
        }

        return {
          ...prev,
          [monsterId]: {
            ...existing,
            [field]: [...currentValues, option.value],
            error: '',
          },
        }
      })
    },
    [],
  )

  const handleMonsterDefenseRemove = useCallback(
    (
      monsterId: string,
      field: 'damageImmunities' | 'damageResistances' | 'damageVulnerabilities',
      value: string,
    ) => {
      setMonsterEdits((prev) => {
        const existing = prev[monsterId]
        if (!existing) {
          return prev
        }

        const currentValues = Array.isArray(existing[field]) ? existing[field] : []
        const filtered = currentValues.filter((entry) => entry !== value)

        return {
          ...prev,
          [monsterId]: {
            ...existing,
            [field]: filtered,
            error: '',
          },
        }
      })
    },
    [],
  )

  /**
   * Stores the temporary tag input while editing a monster.
   */
  const handleMonsterTagDraftChange = useCallback(
    (monsterId: string, value: string) => {
      handleMonsterEditFieldChange(monsterId, 'tagDraft', value)
    },
    [handleMonsterEditFieldChange],
  )

  /**
   * Adds the current tag draft to the monster edit state if it is valid.
   */
  const handleMonsterTagAdd = useCallback((monsterId: string) => {
    setMonsterEdits((prev) => {
      const existing = prev[monsterId]
      if (!existing) {
        return prev
      }

      const draftValue = normalizeMonsterTag(existing.tagDraft)
      if (!draftValue) {
        return {
          ...prev,
          [monsterId]: {
            ...existing,
            tagDraft: '',
          },
        }
      }

      const currentTags = Array.isArray(existing.tags) ? existing.tags : []
      const nextTags = prepareMonsterTags([...currentTags, draftValue])

      return {
        ...prev,
        [monsterId]: {
          ...existing,
          tags: nextTags,
          tagDraft: '',
          error: '',
        },
      }
    })
  }, [])

  /**
   * Removes a specific tag or the most recent tag from the edit draft.
   */
  const handleMonsterTagRemove = useCallback((monsterId: string, tagValue: string | null = null) => {
    setMonsterEdits((prev) => {
      const existing = prev[monsterId]
      if (!existing) {
        return prev
      }

      const currentTags = Array.isArray(existing.tags) ? existing.tags : []
      if (currentTags.length === 0) {
        return prev
      }

      let nextTags: string[]
      if (typeof tagValue === 'string') {
        const key = tagValue.toLowerCase()
        nextTags = currentTags.filter((tag) => tag.toLowerCase() !== key)
      } else {
        nextTags = currentTags.slice(0, currentTags.length - 1)
      }

      return {
        ...prev,
        [monsterId]: {
          ...existing,
          tags: prepareMonsterTags(nextTags),
          error: '',
        },
      }
    })
  }, [])

  /**
   * Provides keyboard shortcuts for adding or removing tags while editing.
   */
  const handleMonsterTagInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, monsterId: string) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault()
        handleMonsterTagAdd(monsterId)
      } else if (event.key === 'Backspace' && !event.currentTarget.value) {
        event.preventDefault()
        handleMonsterTagRemove(monsterId)
      }
    },
    [handleMonsterTagAdd, handleMonsterTagRemove],
  )

  /**
   * Persists the monster edits back into the Redux store.
   */
  const handleSaveMonsterEdit = useCallback(
    (monsterId: string) => {
      const draft = monsterEdits[monsterId]
      if (!draft) {
        return
      }

      const name = draft.name ? draft.name.trim() : ''
      if (!name) {
        setMonsterEdits((prev) => ({
          ...prev,
          [monsterId]: {
            ...draft,
            error: 'A monster needs a name to stalk the initiative order.',
          },
        }))
        return
      }

      const description = typeof draft.description === 'string' ? draft.description : ''
      const armorClassInput = typeof draft.armorClass === 'string' ? draft.armorClass.trim() : ''
      const hitPointsInput = typeof draft.hitPoints === 'string' ? draft.hitPoints.trim() : ''
      const challengeRatingInput =
        typeof draft.challengeRating === 'string' ? draft.challengeRating.trim() : ''

      const damageImmunities = Array.isArray(draft.damageImmunities)
        ? draft.damageImmunities
        : []
      const damageResistances = Array.isArray(draft.damageResistances)
        ? draft.damageResistances
        : []
      const damageVulnerabilities = Array.isArray(draft.damageVulnerabilities)
        ? draft.damageVulnerabilities
        : []

      let armorClassValue: number | null = null
      if (armorClassInput) {
        const parsedAc = Number.parseInt(armorClassInput, 10)
        if (!Number.isFinite(parsedAc) || parsedAc < 0) {
          setMonsterEdits((prev) => ({
            ...prev,
            [monsterId]: {
              ...draft,
              error: 'Armor Class must be a whole number or left blank.',
            },
          }))
          return
        }
        armorClassValue = Math.max(0, Math.trunc(parsedAc))
      }

      let hitPointsValue: number | null = null
      if (hitPointsInput) {
        const parsedHp = Number.parseInt(hitPointsInput, 10)
        if (!Number.isFinite(parsedHp) || parsedHp <= 0) {
          setMonsterEdits((prev) => ({
            ...prev,
            [monsterId]: {
              ...draft,
              error: 'Hit points must be a positive whole number or left blank.',
            },
          }))
          return
        }
        hitPointsValue = Math.max(1, Math.trunc(parsedHp))
      }

      const baseTags = prepareMonsterTags(Array.isArray(draft.tags) ? draft.tags : [])
      const filteredTags = baseTags.filter((tag) => {
        const normalized = tag.toUpperCase()
        return (
          !normalized.startsWith('HP ') &&
          !normalized.startsWith('AC ') &&
          !normalized.startsWith('CR ')
        )
      })

      const monster = monsterLibrary.monsters[monsterId]
      const autoTags: string[] = []
      if (hitPointsValue !== null) {
        const hitDiceSuffix = monster?.hitDice ? ` (${monster.hitDice})` : ''
        autoTags.push(`HP ${hitPointsValue}${hitDiceSuffix}`)
      }
      if (armorClassValue !== null) {
        const armorNotesSuffix = monster?.armorNotes ? ` (${monster.armorNotes})` : ''
        autoTags.push(`AC ${armorClassValue}${armorNotesSuffix}`)
      }
      if (challengeRatingInput) {
        autoTags.push(`CR ${challengeRatingInput}`)
      }

      const tags = prepareMonsterTags([...filteredTags, ...autoTags])

      const damageImmunitiesString = stringifyDefenseList(damageImmunities)
      const damageResistancesString = stringifyDefenseList(damageResistances)
      const damageVulnerabilitiesString = stringifyDefenseList(damageVulnerabilities)

      dispatch(
        updateMonsterDetailsAction({
          monsterId,
          name,
          description,
          tags,
          armorClass: armorClassValue,
          hitPoints: hitPointsValue,
          challengeRating: challengeRatingInput,
          damageImmunities: damageImmunitiesString,
          damageResistances: damageResistancesString,
          damageVulnerabilities: damageVulnerabilitiesString,
        }),
      )

      setMonsterEdits((prev) => {
        const next = { ...prev }
        delete next[monsterId]
        return next
      })
    },
    [dispatch, monsterEdits, monsterLibrary],
  )

  /**
   * Removes a monster from the active campaign library.
   */
  const handleRemoveMonsterTemplateEntry = useCallback(
    (monsterId: string) => {
      if (!activeCampaign) {
        return
      }
      dispatch(
        removeMonsterFromCampaignAction({
          campaignId: activeCampaign.id,
          monsterId,
        }),
      )
    },
    [activeCampaign, dispatch],
  )

  /**
   * Toggles whether a monster is marked as a favorite.
   */
  const handleToggleMonsterFavorite = useCallback(
    (monsterId: string) => {
      dispatch(toggleMonsterFavoriteAction(monsterId))
    },
    [dispatch],
  )

  /**
   * Imports a monster stat block from D&D Beyond into the current campaign.
   */
  const handleImportMonster = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!activeCampaign) {
        setMonsterImportError('Select a campaign before importing monsters.')
        return
      }

      const trimmedUrl = monsterImportUrl.trim()

      if (!trimmedUrl) {
        setMonsterImportError('Provide a D&D Beyond monster URL to import.')
        return
      }

      let normalized: ReturnType<typeof normalizeDndBeyondUrl>
      try {
        normalized = normalizeDndBeyondUrl(trimmedUrl)
      } catch (error) {
        setMonsterImportError(
          error instanceof Error ? error.message : 'Enter a valid D&D Beyond monster URL.',
        )
        return
      }

      setIsMonsterImporting(true)
      setMonsterImportError('')
      setMonsterImportSuccess('')

      try {
        const response = await fetch(`https://r.jina.ai/${normalized.normalizedUrl}`)
        if (!response.ok) {
          throw new Error('Failed to fetch monster data. Check the URL and try again.')
        }

        const text = await response.text()
        const parsedMonster = parseDndBeyondMonster(text, normalized.normalizedUrl)

        dispatch(
          importMonsterAction({
            campaignId: activeCampaign.id,
            monster: parsedMonster,
          }),
        )

        setMonsterImportSuccess(`Imported ${parsedMonster.name} into ${activeCampaign.name}.`)
        setMonsterImportUrl('')
      } catch (error) {
        console.error('Failed to import monster', error)
        setMonsterImportError(
          error instanceof Error
            ? error.message
            : 'Something went wrong while importing the monster.',
        )
      } finally {
        setIsMonsterImporting(false)
      }
    },
    [activeCampaign, dispatch, monsterImportUrl],
  )

  /**
   * Clears the monster import form and related messages.
   */
  const handleClearImportForm = useCallback(() => {
    setMonsterImportUrl('')
    setMonsterImportError('')
    setMonsterImportSuccess('')
  }, [])

  return (
    <>
      <section className="main__header">
        <div>
          <h2>Campaign Manager</h2>
          <p>
            Build multiple worlds, organize notes, and curate hero rosters for every table you run.
          </p>
        </div>
        <div className="header-actions">
          <div className="campaign-summary">
            <div className="summary-card">
              <span className="summary__label">Campaigns</span>
              <span className="summary__value">{campaigns.length}</span>
            </div>
            <div className="summary-card">
              <span className="summary__label">Saved heroes</span>
              <span className="summary__value">
                {campaigns.reduce((count, campaign) => count + campaign.playerCharacters.length, 0)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="campaign-section">
        <header className="campaign-section__header">
          <div>
            <h3>Campaign manager</h3>
            <p>Organize multiple campaigns, craft notes, and maintain reusable party rosters.</p>
          </div>
        </header>
        <div className="campaign-section__content">
          <div className="campaign-manager__sidebar">
            <div className="campaign-manager__list">
              <h4>Your campaigns</h4>
              {sortedCampaigns.length === 0 ? (
                <div className="campaign-manager__empty-list">
                  <p>No campaigns yet. Create one below to begin planning.</p>
                </div>
              ) : (
                <ul>
                  {sortedCampaigns.map((campaign) => (
                    <li key={campaign.id}>
                      <button
                        type="button"
                        className={`campaign-manager__campaign-button${
                          campaign.id === activeCampaignId
                            ? ' campaign-manager__campaign-button--active'
                            : ''
                        }`}
                        onClick={() => handleSelectCampaign(campaign.id)}
                      >
                        <span>{campaign.name}</span>
                        <span className="campaign-manager__campaign-count">
                          {campaign.playerCharacters.length} heroes
                        </span>
                      </button>
                      <button
                        type="button"
                        className="campaign-manager__campaign-remove"
                        onClick={() => handleRemoveCampaign(campaign.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <form className="campaign-form campaign-form--compact" onSubmit={handleCreateCampaign}>
              <h4>Start a new campaign</h4>
              <label>
                <span>Campaign name</span>
                <input
                  value={campaignForm.name}
                  onChange={(event) => handleCampaignFormChange(event.target.value)}
                  placeholder="Rime of the Frostmaiden"
                />
              </label>
              {campaignFormError && <p className="form-error">{campaignFormError}</p>}
              <button type="submit" className="primary-button">
                Create campaign
              </button>
            </form>
          </div>

          <div className="campaign-manager__main">
            {activeCampaign ? (
              <>
                <form className="campaign-form" onSubmit={handleSaveCampaignDetails}>
                  <div className="section-header">
                    <h4>Campaign details</h4>
                    <button
                      type="button"
                      className="section-toggle"
                      onClick={() => setIsCampaignDetailsCollapsed((prev) => !prev)}
                    >
                      {isCampaignDetailsCollapsed ? 'Expand' : 'Minimize'}
                    </button>
                  </div>
                  {!isCampaignDetailsCollapsed && (
                    <>
                      <div className="form-grid campaign-form__grid">
                        <label>
                          <span>Name</span>
                          <input
                            value={campaignDetailsDraft.name}
                            onChange={(event) => handleCampaignDetailsChange('name', event.target.value)}
                            placeholder="The Wild Beyond the Witchlight"
                          />
                        </label>
                        <label className="campaign-form__notes">
                          <span>Notes</span>
                          <textarea
                            value={campaignDetailsDraft.notes}
                            onChange={(event) => handleCampaignDetailsChange('notes', event.target.value)}
                            placeholder="Session summaries, NPC lists, or adventure hooks."
                            rows={4}
                          />
                        </label>
                      </div>
                      {campaignDetailsError && <p className="form-error">{campaignDetailsError}</p>}
                      <div className="campaign-form__actions">
                        <button type="submit" className="primary-button">
                          Save details
                        </button>
                      </div>
                    </>
                  )}
                </form>

                <form className="campaign-form" onSubmit={handleAddPlayerTemplate}>
                  <div className="section-header">
                    <h4>Add a player character</h4>
                    <button
                      type="button"
                      className="section-toggle"
                      onClick={() => setIsPlayerFormCollapsed((prev) => !prev)}
                    >
                      {isPlayerFormCollapsed ? 'Expand' : 'Minimize'}
                    </button>
                  </div>
                  {!isPlayerFormCollapsed && (
                    <>
                      <div className="form-grid campaign-form__grid">
                        <label>
                          <span>Name</span>
                          <input
                            value={playerTemplateForm.name}
                            onChange={(event) => handlePlayerTemplateFormChange('name', event.target.value)}
                            placeholder="Fighter name"
                          />
                        </label>
                        <label>
                          <span>Max HP</span>
                          <input
                            value={playerTemplateForm.maxHp}
                            onChange={(event) => handlePlayerTemplateFormChange('maxHp', event.target.value)}
                            placeholder="45"
                            inputMode="numeric"
                          />
                        </label>
                        <label>
                          <span>Armor Class</span>
                          <input
                            value={playerTemplateForm.armorClass}
                            onChange={(event) =>
                              handlePlayerTemplateFormChange('armorClass', event.target.value)
                            }
                            placeholder="15"
                            inputMode="numeric"
                          />
                        </label>
                        <label>
                          <span>Character link</span>
                          <input
                            value={playerTemplateForm.profileUrl}
                            onChange={(event) =>
                              handlePlayerTemplateFormChange('profileUrl', event.target.value)
                            }
                            placeholder="https://dndbeyond.com/profile/..."
                            inputMode="url"
                          />
                        </label>
                        <label className="campaign-form__notes">
                          <span>Notes</span>
                          <textarea
                            value={playerTemplateForm.notes}
                            onChange={(event) => handlePlayerTemplateFormChange('notes', event.target.value)}
                            placeholder="Personality, spell slots, reminders..."
                            rows={3}
                          />
                        </label>
                      </div>
                      {playerTemplateError && <p className="form-error">{playerTemplateError}</p>}
                      <div className="campaign-form__actions">
                        <button type="submit" className="primary-button">
                          Add to roster
                        </button>
                        <button type="button" className="ghost-button" onClick={resetPlayerTemplateForm}>
                          Clear
                        </button>
                      </div>
                    </>
                  )}
                </form>

                <div className="campaign-roster">
                  <div className="campaign-roster__header section-header">
                    <div>
                      <h4>Saved player characters</h4>
                      <p>Reuse your heroes across sessions with a single click.</p>
                    </div>
                    <button
                      type="button"
                      className="section-toggle"
                      onClick={() => setIsRosterCollapsed((prev) => !prev)}
                    >
                      {isRosterCollapsed ? 'Expand' : 'Minimize'}
                    </button>
                  </div>
                  {!isRosterCollapsed && (
                    <>
                      {activeCampaignRoster.length === 0 ? (
                        <div className="campaign-roster__empty">
                          <p>
                            No heroes saved yet. Chronicle your party above to reuse them across encounters.
                          </p>
                        </div>
                      ) : (
                        <ul className="template-list">
                          {activeCampaignRoster.map((template) => {
                            const editDraft = playerTemplateEdits[template.id] || null
                            const isEditing = Boolean(editDraft)

                        return (
                          <li key={template.id} className="template-card">
                            <header className="template-card__header">
                              <div>
                                {isEditing ? (
                                  <label>
                                    <span>Name</span>
                                    <input
                                      value={editDraft?.name ?? ''}
                                      onChange={(event) =>
                                        handlePlayerTemplateEditFieldChange(
                                          template.id,
                                          'name',
                                          event.target.value,
                                        )
                                      }
                                      placeholder="Character name"
                                    />
                                  </label>
                                ) : (
                                  <>
                                    <h5>{template.name}</h5>
                                    <div className="template-card__stats">
                                      <span className="stat-chip">Max HP {template.maxHp}</span>
                                      {template.armorClass !== null && (
                                        <span className="stat-chip">AC {template.armorClass}</span>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="template-card__header-actions">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      className="ghost-button"
                                      onClick={() => handleCancelPlayerTemplateEdit(template.id)}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="primary-button"
                                      onClick={() => handleSavePlayerTemplateEdit(template.id)}
                                    >
                                      Save changes
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="ghost-button"
                                      onClick={() => handleStartPlayerTemplateEdit(template)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="ghost-button"
                                      onClick={() => handleRemovePlayerTemplate(template.id)}
                                    >
                                      Remove
                                    </button>
                                  </>
                                )}
                              </div>
                            </header>

                            {isEditing ? (
                              <>
                                <div className="form-grid campaign-form__grid">
                                  <label>
                                    <span>Max HP</span>
                                    <input
                                      value={editDraft?.maxHp ?? ''}
                                      onChange={(event) =>
                                        handlePlayerTemplateEditFieldChange(
                                          template.id,
                                          'maxHp',
                                          event.target.value,
                                        )
                                      }
                                      inputMode="numeric"
                                      placeholder="45"
                                    />
                                  </label>
                                  <label>
                                    <span>Armor Class</span>
                                    <input
                                      value={editDraft?.armorClass ?? ''}
                                      onChange={(event) =>
                                        handlePlayerTemplateEditFieldChange(
                                          template.id,
                                          'armorClass',
                                          event.target.value,
                                        )
                                      }
                                      inputMode="numeric"
                                      placeholder="15"
                                    />
                                  </label>
                                  <label>
                                    <span>Character link</span>
                                    <input
                                      value={editDraft?.profileUrl ?? ''}
                                      onChange={(event) =>
                                        handlePlayerTemplateEditFieldChange(
                                          template.id,
                                          'profileUrl',
                                          event.target.value,
                                        )
                                      }
                                      inputMode="url"
                                      placeholder="https://dndbeyond.com/profile/..."
                                    />
                                  </label>
                                  <label className="campaign-form__notes">
                                    <span>Notes</span>
                                    <textarea
                                      value={editDraft?.notes ?? ''}
                                      onChange={(event) =>
                                        handlePlayerTemplateEditFieldChange(
                                          template.id,
                                          'notes',
                                          event.target.value,
                                        )
                                      }
                                      rows={3}
                                      placeholder="Personality, spell slots, reminders..."
                                    />
                                  </label>
                                </div>
                                {editDraft?.error && <p className="form-error">{editDraft.error}</p>}
                              </>
                            ) : (
                              <>
                                {template.profileUrl && (
                                  <a
                                    href={template.profileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="template-card__link"
                                  >
                                    Open character profile
                                  </a>
                                )}
                                {template.notes && (
                                  <p className="template-card__notes">{template.notes}</p>
                                )}
                              </>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                      )}
                    </>
                  )}
                </div>

                <form className="campaign-form" onSubmit={handleImportMonster}>
                  <h4>Import monster from external source</h4>
                  <div className="form-grid campaign-form__grid">
                    <label className="campaign-form__url">
                      <span>Monster URL</span>
                      <input
                        value={monsterImportUrl}
                        onChange={(event) => setMonsterImportUrl(event.target.value)}
                        placeholder="https://www.dndbeyond.com/monsters/ancient-red-dragon"
                        inputMode="url"
                        autoComplete="off"
                      />
                    </label>
                  </div>
                  {monsterImportError && <p className="form-error">{monsterImportError}</p>}
                  {monsterImportSuccess && <p className="form-success">{monsterImportSuccess}</p>}
                  <div className="campaign-form__actions">
                    <button type="submit" className="primary-button" disabled={isMonsterImporting}>
                      {isMonsterImporting ? 'Importing…' : 'Import monster'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={handleClearImportForm}
                      disabled={isMonsterImporting}
                    >
                      Clear
                    </button>
                  </div>
                </form>

                <div className="monster-library">
                  <div className="monster-library__header section-header">
                    <div>
                      <h4>Campaign monsters</h4>
                      <p>Keep your frequently used foes ready for quick initiative drops.</p>
                    </div>
                    <button
                      type="button"
                      className="section-toggle"
                      onClick={() => setIsMonstersCollapsed((prev) => !prev)}
                    >
                      {isMonstersCollapsed ? 'Expand' : 'Minimize'}
                    </button>
                  </div>
                  {!isMonstersCollapsed && (
                    <>
                      {campaignMonsterList.length === 0 ? (
                        <div className="monster-library__empty">
                          <p>No monsters imported yet. Paste a D&D Beyond URL above to add one.</p>
                        </div>
                      ) : (
                        <ul className="monster-library__list">
                          {campaignMonsterList.map(({ monster, entry, isFavorite }) => {
                            const displayTags = getMonsterDisplayTags(monster).filter(
                              (tag) => !isDefenseTag(tag),
                            )
                            const editDraft = monsterEdits[monster.id] || null
                            const isEditing = Boolean(editDraft)

                        const defenseSelections = {
                          damageImmunities:
                            (editDraft && Array.isArray(editDraft.damageImmunities)
                              ? editDraft.damageImmunities
                              : parseDefenseList(monster.damageImmunities)) || [],
                          damageResistances:
                            (editDraft && Array.isArray(editDraft.damageResistances)
                              ? editDraft.damageResistances
                              : parseDefenseList(monster.damageResistances)) || [],
                          damageVulnerabilities:
                            (editDraft && Array.isArray(editDraft.damageVulnerabilities)
                              ? editDraft.damageVulnerabilities
                              : parseDefenseList(monster.damageVulnerabilities)) || [],
                        }

                        const hasDefenseSelections =
                          defenseSelections.damageImmunities.length > 0 ||
                          defenseSelections.damageResistances.length > 0 ||
                          defenseSelections.damageVulnerabilities.length > 0

                        const lastUsedLabel = entry.lastUsedAt
                          ? new Date(entry.lastUsedAt).toLocaleString()
                          : null

                        return (
                          <li key={monster.id} className="template-card monster-card">
                            <header className="template-card__header monster-card__header">
                              <div>
                                <h5>{monster.name}</h5>
                                <p> {monster.description}
                        
                                </p>
                                <div className="template-card__stats monster-card__stats">
                                  {displayTags.map((tag) => (
                                    <span key={tag} className="stat-chip">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="monster-card__header-actions">
                                <button
                                  type="button"
                                  className={`ghost-button monster-card__favorite-button${
                                    isFavorite ? ' monster-card__favorite-button--active' : ''
                                  }`}
                                  onClick={() => handleToggleMonsterFavorite(monster.id)}
                                >
                                  {isFavorite ? '★ Favorite' : '☆ Favorite'}
                                </button>
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() =>
                                    isEditing
                                      ? handleCancelMonsterEdit(monster.id)
                                      : handleStartMonsterEdit(monster)
                                  }
                                >
                                  {isEditing ? 'Cancel edit' : 'Edit details'}
                                </button>
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => handleRemoveMonsterTemplateEntry(monster.id)}
                                >
                                  Remove
                                </button>
                              </div>
                            </header>
                            {isEditing ? (
                              <form
                                className="monster-card__edit-form"
                                onSubmit={(event) => {
                                  event.preventDefault()
                                  handleSaveMonsterEdit(monster.id)
                                }}
                              >
                                <label>
                                  <span>Monster name</span>
                              <input
                                value={editDraft.name}
                                onChange={(event) =>
                                  handleMonsterEditFieldChange(
                                    monster.id,
                                    'name',
                                    event.target.value,
                                  )
                                }
                                placeholder="Gray Ooze"
                                autoComplete="off"
                              />
                            </label>
                            <label className="monster-card__edit-description">
                              <span>Description</span>
                              <textarea
                                value={editDraft.description}
                                onChange={(event) =>
                                  handleMonsterEditFieldChange(
                                    monster.id,
                                    'description',
                                    event.target.value,
                                  )
                                }
                                placeholder="Background lore, lair notes, or encounter reminders."
                                rows={4}
                              />
                            </label>
                            <div className="monster-card__edit-stats">
                              <label>
                                <span>Armor Class</span>
                                <input
                                  value={editDraft.armorClass}
                                  onChange={(event) =>
                                    handleMonsterEditFieldChange(
                                      monster.id,
                                      'armorClass',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="15"
                                  inputMode="numeric"
                                />
                              </label>
                              <label>
                                <span>Hit Points</span>
                                <input
                                  value={editDraft.hitPoints}
                                  onChange={(event) =>
                                    handleMonsterEditFieldChange(
                                      monster.id,
                                      'hitPoints',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="99"
                                  inputMode="numeric"
                                />
                              </label>
                              <label>
                                <span>Challenge Rating</span>
                                <input
                                  value={editDraft.challengeRating}
                                  onChange={(event) =>
                                    handleMonsterEditFieldChange(
                                      monster.id,
                                      'challengeRating',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="5"
                                  autoComplete="off"
                                />
                              </label>
                            </div>
                            <div className="monster-card__defenses">
                              {(
                                [
                                  {
                                    field: 'damageImmunities' as const,
                                    label: 'Immunities',
                                    helper: 'Attacks or conditions that have no effect.',
                                  },
                                  {
                                    field: 'damageResistances' as const,
                                    label: 'Resistances',
                                    helper: 'Sources that deal reduced damage.',
                                  },
                                  {
                                    field: 'damageVulnerabilities' as const,
                                    label: 'Vulnerabilities',
                                    helper: 'Sources that deal increased damage.',
                                  },
                                ] as const
                              ).map(({ field, label, helper }) => {
                                const selectedValues = defenseSelections[field]
                                return (
                                  <div key={field} className="monster-card__defense-row">
                                    <div className="monster-card__defense-label">
                                      <span>{label}</span>
                                      <p>{helper}</p>
                                    </div>
                                    <div className="monster-card__defense-controls">
                                      <label className="monster-card__defense-select">
                                        <span>Select a condition</span>
                                        <select
                                          defaultValue=""
                                          onChange={(event) => {
                                            handleMonsterDefenseAdd(monster.id, field, event.target.value)
                                            event.currentTarget.value = ''
                                          }}
                                        >
                                          <option value="" disabled>
                                            Choose an option…
                                          </option>
                                          <optgroup label="Damage types">
                                            {damageDefenseOptions.map((option) => (
                                              <option
                                                key={`${field}-${option.value}`}
                                                value={option.value}
                                                disabled={selectedValues.includes(option.value)}
                                              >
                                                {option.label}
                                              </option>
                                            ))}
                                          </optgroup>
                                          <optgroup label="Conditions">
                                            {conditionDefenseOptions.map((option) => (
                                              <option
                                                key={`${field}-${option.value}`}
                                                value={option.value}
                                                disabled={selectedValues.includes(option.value)}
                                              >
                                                {option.label}
                                              </option>
                                            ))}
                                          </optgroup>
                                        </select>
                                      </label>
                                      <div className="monster-card__defense-chips">
                                        {selectedValues.length > 0 ? (
                                          selectedValues.map((value) => {
                                            const { backgroundColor, borderColor, color, option } =
                                              getDefenseChipStyle(value)
                                            return (
                                              <span
                                                key={`${field}-${value}`}
                                                className="monster-card__defense-chip"
                                                style={{
                                                  backgroundColor,
                                                  borderColor,
                                                  color,
                                                }}
                                              >
                                                <span className="monster-card__defense-icon" aria-hidden="true">
                                                  {option?.icon || '◆'}
                                                </span>
                                                <span>{option?.label || value}</span>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleMonsterDefenseRemove(monster.id, field, value)
                                                  }
                                                  aria-label={`Remove ${option?.label || value}`}
                                                >
                                                  ×
                                                </button>
                                              </span>
                                            )
                                          })
                                        ) : (
                                          <span className="monster-card__edit-tags-empty">No selections yet.</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            <label className="monster-card__edit-tags">
                              <span>Tags</span>
                              <div className="monster-card__edit-tags-list">
                                {Array.isArray(editDraft.tags) && editDraft.tags.length > 0 ? (
                                  editDraft.tags.map((tag) => (
                                        <span key={tag} className="monster-card__edit-tag stat-chip">
                                          {tag}
                                          <button
                                            type="button"
                                            onClick={() => handleMonsterTagRemove(monster.id, tag)}
                                            aria-label={`Remove tag ${tag}`}
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ))
                                    ) : (
                                      <span className="monster-card__edit-tags-empty">No tags yet.</span>
                                    )}
                                  </div>
                                  <div className="monster-card__edit-tags-input">
                                    <input
                                      value={typeof editDraft.tagDraft === 'string' ? editDraft.tagDraft : ''}
                                      onChange={(event) =>
                                        handleMonsterTagDraftChange(monster.id, event.target.value)
                                      }
                                      onKeyDown={(event) => handleMonsterTagInputKeyDown(event, monster.id)}
                                      placeholder="Add a tag and press Enter"
                                    />
                                    <button type="button" className="ghost-button" onClick={() => handleMonsterTagAdd(monster.id)}>
                                      Add tag
                                    </button>
                                  </div>
                                </label>
                                {editDraft.error && <p className="form-error">{editDraft.error}</p>}
                                <div className="monster-card__edit-actions">
                                  <button type="submit" className="primary-button">
                                    Save monster
                                  </button>
                                  <button
                                    type="button"
                                    className="ghost-button"
                                    onClick={() => handleCancelMonsterEdit(monster.id)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <>
                                {hasDefenseSelections && (
                                  <div className="monster-card__defenses monster-card__defenses--preview">
                                    {(
                                      [
                                        { field: 'damageImmunities' as const, label: 'Immunities' },
                                        { field: 'damageResistances' as const, label: 'Resistances' },
                                        { field: 'damageVulnerabilities' as const, label: 'Vulnerabilities' },
                                      ] as const
                                    ).map(({ field, label }) => {
                                      const selectedValues = defenseSelections[field]
                                      if (selectedValues.length === 0) {
                                        return null
                                      }

                                      return (
                                        <div key={field} className="monster-card__defense-row">
                                          <div className="monster-card__defense-label">
                                            <span>{label}</span>
                                          </div>
                                          <div className="monster-card__defense-chips">
                                            {selectedValues.map((value) => {
                                              const { backgroundColor, borderColor, color, option } =
                                                getDefenseChipStyle(value)
                                              return (
                                                <span
                                                  key={`${field}-${value}`}
                                                  className="monster-card__defense-chip"
                                                  style={{ backgroundColor, borderColor, color }}
                                                >
                                                  <span className="monster-card__defense-icon" aria-hidden="true">
                                                    {option?.icon || '◆'}
                                                  </span>
                                                  <span>{option?.label || value}</span>
                                                </span>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                                <footer className="monster-card__footer">
                                  <div className="monster-card__meta">
                                    <span className="monster-card__meta-item">
                                      Imported {new Date(monster.importedAt).toLocaleDateString()}
                                    </span>
                                    {lastUsedLabel && (
                                      <span className="monster-card__meta-item">
                                        Last used {lastUsedLabel}
                                      </span>
                                    )}
                                  </div>
                                  {monster.sourceUrl && (
                                    <a
                                      href={monster.sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="monster-card__link"
                                    >
                                      View on D&D Beyond
                                    </a>
                                  )}
                                </footer>
                              </>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="campaign-manager__empty">
                <p>Select a campaign or create a new one to start building its roster.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

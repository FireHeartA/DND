import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import './App.css'
import {
  addCombatant,
  applyDamage,
  applyHealing,
  clearMonsters,
  loadState as loadCombatStateAction,
  removeCombatant as removeCombatantAction,
  resetCombatant as resetCombatantAction,
  updateInitiative as updateInitiativeAction,
} from './store/combatSlice'
import {
  addPlayerCharacter as addPlayerCharacterAction,
  createCampaign as createCampaignAction,
  loadState as loadCampaignStateAction,
  removeCampaign as removeCampaignAction,
  removePlayerCharacter as removePlayerCharacterAction,
  setActiveCampaign as setActiveCampaignAction,
  updateCampaignDetails as updateCampaignDetailsAction,
} from './store/campaignSlice'
import {
  importMonster as importMonsterAction,
  removeMonsterFromCampaign as removeMonsterFromCampaignAction,
  toggleMonsterFavorite as toggleMonsterFavoriteAction,
  recordMonsterUsage as recordMonsterUsageAction,
  updateMonsterDetails as updateMonsterDetailsAction,
  loadState as loadMonsterLibraryStateAction,
} from './store/monsterLibrarySlice'
import { parseDndBeyondMonster, normalizeDndBeyondUrl } from './utils/dndBeyondMonsterParser'

const formatDurationClock = (durationMs) => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '00:00'
  }

  const totalSeconds = Math.floor(durationMs / 1000)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60)
  const hours = Math.floor(minutes / 60)
  const minutesComponent = minutes % 60

  const pad = (value) => String(value).padStart(2, '0')

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutesComponent)}:${pad(seconds)}`
  }

  return `${pad(minutes)}:${pad(seconds)}`
}

const formatDurationVerbose = (durationMs) => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '0s'
  }

  const totalSeconds = Math.floor(durationMs / 1000)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  const parts = []

  if (hours > 0) {
    parts.push(`${hours}h`)
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`)
  }

  parts.push(`${seconds}s`)

  return parts.join(' ')
}

const computeCombatStats = (history) => {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      totalDuration: 0,
      totalTurns: 0,
      averageTurnDuration: 0,
      longestTurnEntry: null,
      fastestTurnEntry: null,
      slowestAverage: null,
      quickestAverage: null,
      combatantStats: [],
    }
  }

  const summaryByCombatant = new Map()
  let totalDuration = 0
  let longestTurnEntry = null
  let fastestTurnEntry = null

  history.forEach((entry) => {
    const duration = entry.duration ?? 0
    totalDuration += duration

    if (!longestTurnEntry || duration > longestTurnEntry.duration) {
      longestTurnEntry = entry
    }

    if (!fastestTurnEntry || duration < fastestTurnEntry.duration) {
      fastestTurnEntry = entry
    }

    const current = summaryByCombatant.get(entry.combatantId) || {
      combatantId: entry.combatantId,
      name: entry.combatantName,
      totalDuration: 0,
      turnCount: 0,
      longestTurn: 0,
    }

    const nextTotal = current.totalDuration + duration
    const nextTurnCount = current.turnCount + 1
    const nextLongest = Math.max(current.longestTurn, duration)

    summaryByCombatant.set(entry.combatantId, {
      ...current,
      totalDuration: nextTotal,
      turnCount: nextTurnCount,
      longestTurn: nextLongest,
    })
  })

  const combatantStats = Array.from(summaryByCombatant.values()).map((entry) => ({
    ...entry,
    averageDuration: entry.turnCount > 0 ? entry.totalDuration / entry.turnCount : 0,
  }))

  const slowestAverage = combatantStats.reduce((accumulator, entry) => {
    if (!accumulator || entry.averageDuration > accumulator.averageDuration) {
      return entry
    }
    return accumulator
  }, null)

  const quickestAverage = combatantStats.reduce((accumulator, entry) => {
    if (!accumulator || entry.averageDuration < accumulator.averageDuration) {
      return entry
    }
    return accumulator
  }, null)

  combatantStats.sort((a, b) => b.totalDuration - a.totalDuration)

  return {
    totalDuration,
    totalTurns: history.length,
    averageTurnDuration: totalDuration / history.length,
    longestTurnEntry,
    fastestTurnEntry,
    slowestAverage,
    quickestAverage,
    combatantStats,
  }
}

const normalizeMonsterTagForDisplay = (tag) => {
  if (!tag) {
    return null
  }

  if (typeof tag === 'string') {
    const label = tag.trim()
    if (!label) {
      return null
    }
    return {
      id: label,
      label,
      key: null,
      removable: true,
    }
  }

  if (typeof tag !== 'object') {
    return null
  }

  const label = typeof tag.label === 'string' ? tag.label.trim() : ''
  if (!label) {
    return null
  }

  return {
    id:
      typeof tag.id === 'string' && tag.id.trim().length > 0 ? tag.id.trim() : label,
    label,
    key: typeof tag.key === 'string' && tag.key.trim().length > 0 ? tag.key.trim() : null,
    removable: tag.removable !== false,
  }
}

const displayTagPriority = (tag) => {
  if (!tag || !tag.label) {
    return 5
  }

  if (tag.key === 'hp') {
    return 0
  }

  if (tag.key === 'ac') {
    return 1
  }

  const lower = tag.label.toLowerCase()
  if (lower.startsWith('hp ')) {
    return 0
  }
  if (lower.startsWith('ac ')) {
    return 1
  }
  return 2
}

const sortMonsterTagsForDisplay = (tags) =>
  tags
    .map((tag, index) => ({ tag, index }))
    .sort((a, b) => {
      const diff = displayTagPriority(a.tag) - displayTagPriority(b.tag)
      if (diff !== 0) {
        return diff
      }
      return a.index - b.index
    })
    .map(({ tag }) => tag)

const buildDisplayTags = (tags) => {
  if (!Array.isArray(tags)) {
    return []
  }

  const normalized = tags
    .map((tag) => normalizeMonsterTagForDisplay(tag))
    .filter((entry) => entry && entry.label)

  return sortMonsterTagsForDisplay(normalized)
}

const buildEditableTags = (tags) =>
  buildDisplayTags(tags).map((tag, index) => ({
    id: tag.id || `${tag.label}-${index}`,
    label: tag.label,
    key: tag.key || null,
    removable: tag.key === 'hp' || tag.key === 'ac' ? false : tag.removable !== false,
  }))

function App() {
  const dispatch = useDispatch()
  const store = useStore()
  const combatants = useSelector((state) => state.combat.combatants)
  const campaigns = useSelector((state) => state.campaigns.campaigns)
  const activeCampaignId = useSelector((state) => state.campaigns.activeCampaignId)
  const monsterLibrary = useSelector((state) => state.monsterLibrary)
  const [formData, setFormData] = useState({
    name: '',
    maxHp: '',
    initiative: '',
    type: 'player',
  })
  const [formError, setFormError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [adjustments, setAdjustments] = useState({})
  const [initiativeDrafts, setInitiativeDrafts] = useState({})
  const [activeView, setActiveView] = useState('initiative')
  const [playerTemplateForm, setPlayerTemplateForm] = useState({
    name: '',
    maxHp: '',
    armorClass: '',
    notes: '',
  })
  const [playerTemplateError, setPlayerTemplateError] = useState('')
  const [templateInitiatives, setTemplateInitiatives] = useState({})
  const [templateErrors, setTemplateErrors] = useState({})
  const [monsterInitiatives, setMonsterInitiatives] = useState({})
  const [monsterErrors, setMonsterErrors] = useState({})
  const [monsterEdits, setMonsterEdits] = useState({})
  const [campaignForm, setCampaignForm] = useState({ name: '' })
  const [campaignFormError, setCampaignFormError] = useState('')
  const [campaignDetailsDraft, setCampaignDetailsDraft] = useState({
    name: '',
    notes: '',
  })
  const [campaignDetailsError, setCampaignDetailsError] = useState('')
  const [activeCombatantId, setActiveCombatantId] = useState(null)
  const [turnHistory, setTurnHistory] = useState([])
  const [turnStartTime, setTurnStartTime] = useState(null)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [isStatsVisible, setIsStatsVisible] = useState(false)
  const [lastCombatStats, setLastCombatStats] = useState(null)
  const fileInputRef = useRef(null)
  const [monsterImportUrl, setMonsterImportUrl] = useState('')
  const [monsterImportError, setMonsterImportError] = useState('')
  const [monsterImportSuccess, setMonsterImportSuccess] = useState('')
  const [isMonsterImporting, setIsMonsterImporting] = useState(false)
  const isCombatActive = activeCombatantId !== null

  const sortedCombatants = useMemo(() => {
    return [...combatants].sort((a, b) => {
      if (b.initiative === a.initiative) {
        return a.createdAt - b.createdAt
      }
      return b.initiative - a.initiative
    })
  }, [combatants])

  const activeCampaign = useMemo(() => {
    return campaigns.find((campaign) => campaign.id === activeCampaignId) || null
  }, [campaigns, activeCampaignId])

  const activeCampaignRoster = useMemo(() => {
    if (!activeCampaign) {
      return []
    }

    return [...activeCampaign.playerCharacters].sort((a, b) => a.createdAt - b.createdAt)
  }, [activeCampaign])

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => a.createdAt - b.createdAt)
  }, [campaigns])

  const totalSavedCharacters = useMemo(() => {
    return campaigns.reduce(
      (count, campaign) => count + campaign.playerCharacters.length,
      0,
    )
  }, [campaigns])

  const campaignMonsterList = useMemo(() => {
    if (!activeCampaign) {
      return []
    }

    const libraryEntries = monsterLibrary.campaignLibraries[activeCampaign.id] || []
    return libraryEntries
      .map((entry) => {
        const monster = monsterLibrary.monsters[entry.monsterId]
        if (!monster) {
          return null
        }
        return {
          monster,
          entry,
          isFavorite: monsterLibrary.favorites.includes(entry.monsterId),
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const lastA = a.entry.lastUsedAt || 0
        const lastB = b.entry.lastUsedAt || 0

        if (lastA !== lastB) {
          return lastB - lastA
        }

        if (a.entry.usageCount !== b.entry.usageCount) {
          return b.entry.usageCount - a.entry.usageCount
        }

        return b.entry.addedAt - a.entry.addedAt
      })
  }, [activeCampaign, monsterLibrary])

  const favoriteMonsterList = useMemo(() => {
    if (!monsterLibrary || !Array.isArray(monsterLibrary.favorites)) {
      return []
    }

    const activeLibrary =
      activeCampaign && monsterLibrary.campaignLibraries[activeCampaign.id]
        ? monsterLibrary.campaignLibraries[activeCampaign.id]
        : []

    return monsterLibrary.favorites
      .map((monsterId) => {
        const monster = monsterLibrary.monsters[monsterId]
        if (!monster) {
          return null
        }

        const isInActiveCampaign = activeLibrary.some(
          (entry) => entry.monsterId === monsterId,
        )

        return {
          monster,
          isInActiveCampaign,
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const usageA = a.monster.totalUsageCount || 0
        const usageB = b.monster.totalUsageCount || 0

        if (usageA !== usageB) {
          return usageB - usageA
        }

        const updatedA = a.monster.updatedAt || 0
        const updatedB = b.monster.updatedAt || 0
        return updatedB - updatedA
      })
  }, [monsterLibrary, activeCampaign])

  const visibleMonsterIds = useMemo(() => {
    const ids = []
    const seen = new Set()

    campaignMonsterList.forEach(({ monster }) => {
      if (!seen.has(monster.id)) {
        seen.add(monster.id)
        ids.push(monster.id)
      }
    })

    favoriteMonsterList.forEach(({ monster }) => {
      if (!seen.has(monster.id)) {
        seen.add(monster.id)
        ids.push(monster.id)
      }
    })

    return ids
  }, [campaignMonsterList, favoriteMonsterList])

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const resetForm = () => {
    setFormData({ name: '', maxHp: '', initiative: '', type: 'player' })
  }

  const handlePlayerTemplateFormChange = (field, value) => {
    setPlayerTemplateForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const resetPlayerTemplateForm = () => {
    setPlayerTemplateForm({ name: '', maxHp: '', armorClass: '', notes: '' })
  }

  const handleMonsterInitiativeChange = (monsterId, value) => {
    setMonsterInitiatives((prev) => ({
      ...prev,
      [monsterId]: value,
    }))
  }

  const handleRemoveMonsterTemplateEntry = (monsterId) => {
    if (!activeCampaignId) {
      return
    }

    dispatch(
      removeMonsterFromCampaignAction({
        campaignId: activeCampaignId,
        monsterId,
      }),
    )

    setMonsterInitiatives((prev) => {
      if (!(monsterId in prev)) {
        return prev
      }
      const next = { ...prev }
      delete next[monsterId]
      return next
    })

    setMonsterErrors((prev) => {
      if (!(monsterId in prev)) {
        return prev
      }
      const next = { ...prev }
      delete next[monsterId]
      return next
    })

    setMonsterEdits((prev) => {
      if (!(monsterId in prev)) {
        return prev
      }
      const next = { ...prev }
      delete next[monsterId]
      return next
    })
  }

  const handleToggleMonsterFavoriteClick = (monsterId) => {
    dispatch(toggleMonsterFavoriteAction(monsterId))
  }

  const handleStartMonsterEdit = (monster) => {
    if (!monster || !monster.id) {
      return
    }

    const editableTags = buildEditableTags(monster.tags)

    setMonsterEdits((prev) => ({
      ...prev,
      [monster.id]: {
        name: monster.name || '',
        description:
          Array.isArray(monster.description) && monster.description.length > 0
            ? monster.description.join('\n\n')
            : '',
        tags: editableTags,
        newTag: '',
        error: '',
        tagError: '',
      },
    }))
  }

  const handleCancelMonsterEdit = (monsterId) => {
    setMonsterEdits((prev) => {
      if (!(monsterId in prev)) {
        return prev
      }
      const next = { ...prev }
      delete next[monsterId]
      return next
    })
  }

  const handleMonsterEditFieldChange = (monsterId, field, value) => {
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
  }

  const createDraftTagId = () =>
    `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  const handleMonsterTagDraftChange = (monsterId, value) => {
    setMonsterEdits((prev) => {
      const existing = prev[monsterId]
      if (!existing) {
        return prev
      }

      return {
        ...prev,
        [monsterId]: {
          ...existing,
          newTag: value,
          tagError: '',
        },
      }
    })
  }

  const handleMonsterTagAdd = (monsterId) => {
    setMonsterEdits((prev) => {
      const existing = prev[monsterId]
      if (!existing) {
        return prev
      }

      const draftValue = typeof existing.newTag === 'string' ? existing.newTag.trim() : ''
      if (!draftValue) {
        return {
          ...prev,
          [monsterId]: {
            ...existing,
            tagError: 'Enter a tag label before adding it.',
          },
        }
      }

      const tags = Array.isArray(existing.tags) ? existing.tags : []
      const hasDuplicate = tags.some(
        (tag) => tag && typeof tag.label === 'string' && tag.label.toLowerCase() === draftValue.toLowerCase(),
      )

      if (hasDuplicate) {
        return {
          ...prev,
          [monsterId]: {
            ...existing,
            tagError: 'That tag is already listed for this creature.',
          },
        }
      }

      const nextTag = {
        id: createDraftTagId(),
        label: draftValue,
        key: null,
        removable: true,
      }

      return {
        ...prev,
        [monsterId]: {
          ...existing,
          tags: [...tags, nextTag],
          newTag: '',
          tagError: '',
        },
      }
    })
  }

  const handleMonsterTagRemove = (monsterId, tagToRemove) => {
    setMonsterEdits((prev) => {
      const existing = prev[monsterId]
      if (!existing) {
        return prev
      }

      const tags = Array.isArray(existing.tags) ? existing.tags : []
      const index = tags.findIndex((tag) => {
        if (!tagToRemove) {
          return false
        }
        if (tag.id && tagToRemove.id) {
          return tag.id === tagToRemove.id
        }
        return tag.label === tagToRemove.label
      })

      if (index === -1) {
        return prev
      }

      const target = tags[index]
      if (target && (target.key === 'hp' || target.key === 'ac' || target.removable === false)) {
        return {
          ...prev,
          [monsterId]: {
            ...existing,
            tagError: 'AC and HP stay pinned for fast reference.',
          },
        }
      }

      const nextTags = tags.filter((_, tagIndex) => tagIndex !== index)

      return {
        ...prev,
        [monsterId]: {
          ...existing,
          tags: nextTags,
          tagError: '',
        },
      }
    })
  }

  const handleSaveMonsterEdit = (monsterId) => {
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

    const preparedTags = Array.isArray(draft.tags)
      ? draft.tags
          .map((tag) => {
            if (!tag || typeof tag.label !== 'string') {
              return null
            }

            const trimmedLabel = tag.label.trim()
            if (!trimmedLabel) {
              return null
            }

            const key =
              typeof tag.key === 'string' && tag.key.trim().length > 0
                ? tag.key.trim()
                : null

            return {
              id:
                typeof tag.id === 'string' && tag.id.trim().length > 0
                  ? tag.id.trim()
                  : null,
              label: trimmedLabel,
              key,
              removable: key === 'hp' || key === 'ac' ? false : tag.removable !== false,
            }
          })
          .filter(Boolean)
      : []

    dispatch(
      updateMonsterDetailsAction({
        monsterId,
        name,
        description,
        tags: preparedTags,
      }),
    )

    setMonsterEdits((prev) => {
      const next = { ...prev }
      delete next[monsterId]
      return next
    })
  }

  const handleQuickAddMonster = (monsterId, sourceCampaignId = null) => {
    const draft = monsterInitiatives[monsterId]
    const rawInitiative = typeof draft === 'string' ? draft.trim() : ''
    const initiativeValue = Number.parseInt(rawInitiative, 10)

    if (!Number.isFinite(initiativeValue)) {
      setMonsterErrors((prev) => ({
        ...prev,
        [monsterId]: 'Set an initiative before adding to the tracker.',
      }))
      return
    }

    const monster = monsterLibrary.monsters[monsterId]
    if (!monster) {
      setMonsterErrors((prev) => {
        const next = { ...prev }
        delete next[monsterId]
        return next
      })
      return
    }

    const maxHp =
      Number.isFinite(monster.hitPoints) && monster.hitPoints > 0 ? monster.hitPoints : 1

    dispatch(
      addCombatant({
        name: monster.name,
        maxHp,
        initiative: Math.trunc(initiativeValue),
        type: 'monster',
        armorClass: monster.armorClass,
        notes: monster.notes,
        sourceMonsterId: monsterId,
        sourceCampaignId: sourceCampaignId || (activeCampaign ? activeCampaign.id : null),
      }),
    )

    setMonsterInitiatives((prev) => ({
      ...prev,
      [monsterId]: '',
    }))

    setMonsterErrors((prev) => {
      const next = { ...prev }
      delete next[monsterId]
      return next
    })

    const usageCampaignId = activeCampaign ? activeCampaign.id : sourceCampaignId
    dispatch(
      recordMonsterUsageAction({
        monsterId,
        campaignId: usageCampaignId ? String(usageCampaignId) : null,
      }),
    )
  }

  const handleImportMonster = async (event) => {
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

    let normalized
    try {
      normalized = normalizeDndBeyondUrl(trimmedUrl)
    } catch (error) {
      setMonsterImportError(
        error instanceof Error
          ? error.message
          : 'Enter a valid D&D Beyond monster URL.',
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
      setMonsterImportError(
        error instanceof Error
          ? error.message
          : 'Failed to import monster. Please try again.',
      )
    } finally {
      setIsMonsterImporting(false)
    }
  }

  const handleAddCombatant = (event) => {
    event.preventDefault()
    const name = formData.name.trim()
    const maxHp = Number.parseInt(formData.maxHp, 10)
    const initiative = Number.parseInt(formData.initiative, 10)
    const type = formData.type === 'monster' ? 'monster' : 'player'

    if (!name) {
      setFormError('A creature needs a name worthy of the tale.')
      return
    }

    if (!Number.isFinite(maxHp) || maxHp <= 0) {
      setFormError('Max HP must be a positive number.')
      return
    }

    if (!Number.isFinite(initiative)) {
      setFormError('Set an initiative so they know when to strike.')
      return
    }

    const action = dispatch(
      addCombatant({
        name,
        maxHp,
        initiative,
        type,
      }),
    )
    const { id } = action.payload

    setAdjustments((prev) => ({
      ...prev,
      [id]: '',
    }))

    setInitiativeDrafts((prev) => ({
      ...prev,
      [id]: { value: String(initiative), isDirty: false },
    }))

    setFormError('')
    resetForm()
  }

  const handleAddPlayerTemplate = (event) => {
    event.preventDefault()

    const name = playerTemplateForm.name.trim()
    const maxHp = Number.parseInt(playerTemplateForm.maxHp, 10)
    const armorClassValue = Number.parseInt(playerTemplateForm.armorClass, 10)
    const notes = playerTemplateForm.notes.trim()

    if (!activeCampaignId) {
      setPlayerTemplateError('Select or create a campaign before adding heroes.')
      return
    }

    if (!name) {
      setPlayerTemplateError('Your hero needs a name before joining the roster.')
      return
    }

    if (!Number.isFinite(maxHp) || maxHp <= 0) {
      setPlayerTemplateError('Max HP must be a positive number for your heroes.')
      return
    }

    const armorClass = Number.isFinite(armorClassValue)
      ? Math.max(0, Math.trunc(armorClassValue))
      : null

    dispatch(
      addPlayerCharacterAction({
        campaignId: activeCampaignId,
        name,
        maxHp: Math.trunc(maxHp),
        armorClass,
        notes,
      }),
    )

    setPlayerTemplateError('')
    resetPlayerTemplateForm()
  }

  const handleAdjustmentChange = (id, value) => {
    setAdjustments((prev) => ({
      ...prev,
      [id]: value,
    }))
  }

  const handleRemovePlayerTemplate = (id) => {
    if (!activeCampaignId) {
      return
    }

    dispatch(
      removePlayerCharacterAction({
        campaignId: activeCampaignId,
        characterId: id,
      }),
    )
  }

  const handleTemplateInitiativeChange = (id, value) => {
    setTemplateInitiatives((prev) => ({
      ...prev,
      [id]: value,
    }))
  }

  const handleQuickAddFromTemplate = (id) => {
    if (!activeCampaign) {
      setTemplateErrors((prev) => ({
        ...prev,
        [id]: 'Select a campaign before adding heroes to initiative.',
      }))
      return
    }

    const template = activeCampaignRoster.find((entry) => entry.id === id)

    if (!template) {
      setTemplateErrors((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return
    }

    const draftValue = templateInitiatives[id]
    const rawInitiative = typeof draftValue === 'string' ? draftValue.trim() : ''
    const initiative = Number.parseInt(rawInitiative, 10)

    if (!Number.isFinite(initiative)) {
      setTemplateErrors((prev) => ({
        ...prev,
        [id]: 'Set an initiative before adding to the tracker.',
      }))
      return
    }

    dispatch(
      addCombatant({
        name: template.name,
        maxHp: template.maxHp,
        initiative: Math.trunc(initiative),
        type: 'player',
        armorClass: template.armorClass,
        notes: template.notes,
        sourceTemplateId: template.id,
        sourceCampaignId: activeCampaign.id,
      }),
    )

    setTemplateErrors((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })

    setTemplateInitiatives((prev) => ({
      ...prev,
      [id]: '',
    }))
  }

  const handleCampaignFormChange = (field, value) => {
    setCampaignForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const resetCampaignForm = () => {
    setCampaignForm({ name: '' })
  }

  const handleCreateCampaign = (event) => {
    event.preventDefault()
    const name = campaignForm.name.trim()

    if (!name) {
      setCampaignFormError('Name your campaign to begin planning your adventures.')
      return
    }

    dispatch(createCampaignAction({ name }))
    setCampaignFormError('')
    resetCampaignForm()
  }

  const handleSelectCampaign = (campaignId) => {
    dispatch(setActiveCampaignAction(campaignId))
    setPlayerTemplateError('')
    setTemplateErrors({})
  }

  const handleRemoveCampaign = (campaignId) => {
    dispatch(removeCampaignAction(campaignId))
  }

  const handleCampaignDetailsChange = (field, value) => {
    setCampaignDetailsDraft((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSaveCampaignDetails = (event) => {
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
  }

  const activeHeader =
    activeView === 'campaigns'
      ? {
          title: 'Campaign Manager',
          description:
            'Build multiple worlds, organize notes, and curate hero rosters for every table you run.',
        }
      : {
          title: 'Initiative Tracker',
          description:
            'Command the flow of battle by managing heroes and monsters in one place.',
        }

  const applyAdjustment = (id, direction) => {
    const rawValue = adjustments[id]
    const amount = Number.parseInt(rawValue, 10)

    if (!Number.isFinite(amount) || amount <= 0) {
      setAdjustments((prev) => ({
        ...prev,
        [id]: '',
      }))
      return
    }

    if (direction === 'damage') {
      dispatch(applyDamage({ id, amount }))
    } else {
      dispatch(applyHealing({ id, amount }))
    }

    setAdjustments((prev) => ({
      ...prev,
      [id]: '',
    }))
  }

  const handleInitiativeDraftChange = (id, value) => {
    setInitiativeDrafts((prev) => ({
      ...prev,
      [id]: { value, isDirty: true },
    }))
  }

  const revertInitiativeDraft = (id) => {
    const combatant = combatants.find((entry) => entry.id === id)

    if (!combatant) {
      setInitiativeDrafts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return
    }

    setInitiativeDrafts((prev) => ({
      ...prev,
      [id]: { value: String(combatant.initiative), isDirty: false },
    }))
  }

  const commitInitiativeChange = (id) => {
    const combatant = combatants.find((entry) => entry.id === id)

    if (!combatant) return

    const draftEntry = initiativeDrafts[id]
    const rawValue = draftEntry ? draftEntry.value.trim() : ''
    const parsedInitiative = Number.parseInt(rawValue, 10)

    if (!Number.isFinite(parsedInitiative)) {
      revertInitiativeDraft(id)
      return
    }

    if (parsedInitiative === combatant.initiative) {
      setInitiativeDrafts((prev) => ({
        ...prev,
        [id]: { value: String(parsedInitiative), isDirty: false },
      }))
      return
    }

    dispatch(updateInitiativeAction({ id, initiative: parsedInitiative }))

    setInitiativeDrafts((prev) => ({
      ...prev,
      [id]: { value: String(parsedInitiative), isDirty: false },
    }))
  }

  const handleInitiativeKeyDown = (event, id) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitInitiativeChange(id)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      revertInitiativeDraft(id)
    }
  }

  const handleRemoveCombatant = (id) => {
    dispatch(removeCombatantAction(id))
    setAdjustments((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setInitiativeDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleResetCombatant = (id) => {
    dispatch(resetCombatantAction(id))
  }

  const handleClearMonsters = () => {
    const monsterIds = combatants
      .filter((combatant) => combatant.type === 'monster')
      .map((combatant) => combatant.id)

    if (monsterIds.length === 0) {
      return
    }

    dispatch(clearMonsters())
    setAdjustments((prev) => {
      const next = { ...prev }
      monsterIds.forEach((id) => {
        delete next[id]
      })
      return next
    })
    setInitiativeDrafts((prev) => {
      const next = { ...prev }
      monsterIds.forEach((id) => {
        delete next[id]
      })
      return next
    })
  }

  useEffect(() => {
    setAdjustments((prev) => {
      const validIds = new Set(combatants.map((combatant) => combatant.id))
      const shouldUpdate = Object.keys(prev).some(
        (id) => !validIds.has(id),
      )

      if (!shouldUpdate) {
        return prev
      }

      const next = {}
      validIds.forEach((id) => {
        if (prev[id] !== undefined) {
          next[id] = prev[id]
        }
      })

      return next
    })
  }, [combatants])

  useEffect(() => {
    setInitiativeDrafts((prev) => {
      const next = {}

      combatants.forEach((combatant) => {
        const previousEntry = prev[combatant.id]

        if (previousEntry) {
          next[combatant.id] = previousEntry.isDirty
            ? previousEntry
            : { value: String(combatant.initiative), isDirty: false }
        } else {
          next[combatant.id] = {
            value: String(combatant.initiative),
            isDirty: false,
          }
        }
      })

      return next
    })
  }, [combatants])

  useEffect(() => {
    setTemplateInitiatives((prev) => {
      const next = {}

      activeCampaignRoster.forEach((template) => {
        next[template.id] =
          typeof prev[template.id] === 'string' ? prev[template.id] : ''
      })

      return next
    })

    setTemplateErrors((prev) => {
      const next = {}

      activeCampaignRoster.forEach((template) => {
        if (prev[template.id]) {
          next[template.id] = prev[template.id]
        }
      })

      return next
    })
  }, [activeCampaignRoster])

  useEffect(() => {
    setMonsterInitiatives((prev) => {
      const next = {}

      visibleMonsterIds.forEach((id) => {
        next[id] = typeof prev[id] === 'string' ? prev[id] : ''
      })

      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(next)

      if (
        prevKeys.length === nextKeys.length &&
        prevKeys.every((key) => next[key] === prev[key])
      ) {
        return prev
      }

      return next
    })

    setMonsterErrors((prev) => {
      const next = {}

      visibleMonsterIds.forEach((id) => {
        if (prev[id]) {
          next[id] = prev[id]
        }
      })

      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(next)

      if (
        prevKeys.length === nextKeys.length &&
        prevKeys.every((key) => next[key] === prev[key])
      ) {
        return prev
      }

      return next
    })
  }, [visibleMonsterIds])

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

  useEffect(() => {
    setMonsterImportError('')
    setMonsterImportSuccess('')
    setMonsterImportUrl('')
  }, [activeCampaignId])

  useEffect(() => {
    if (!isCombatActive || turnStartTime === null) {
      return
    }

    setCurrentTime(Date.now())

    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isCombatActive, turnStartTime])

  const hasMonsters = combatants.some((combatant) => combatant.type === 'monster')

  useEffect(() => {
    if (sortedCombatants.length === 0) {
      if (activeCombatantId !== null) {
        setActiveCombatantId(null)
      }
      if (turnStartTime !== null) {
        setTurnStartTime(null)
      }
      return
    }

    if (activeCombatantId === null) {
      return
    }

    const isActivePresent = sortedCombatants.some(
      (combatant) => combatant.id === activeCombatantId,
    )

    if (!isActivePresent) {
      setActiveCombatantId(sortedCombatants[0].id)
      setTurnStartTime(Date.now())
    }
  }, [sortedCombatants, activeCombatantId, turnStartTime])

  const recordTurnDuration = (endTimestamp = Date.now()) => {
    if (activeCombatantId === null || turnStartTime === null) {
      return turnHistory
    }

    const combatant = combatants.find((entry) => entry.id === activeCombatantId)
    const entry = {
      combatantId: activeCombatantId,
      combatantName: combatant ? combatant.name : 'Unknown combatant',
      startedAt: turnStartTime,
      endedAt: endTimestamp,
      duration: Math.max(0, endTimestamp - turnStartTime),
    }

    let nextHistory = null

    setTurnHistory((prev) => {
      const updatedHistory = [...prev, entry]
      nextHistory = updatedHistory
      return updatedHistory
    })

    return nextHistory ?? [...turnHistory, entry]
  }

  const handleStartCombat = () => {
    if (sortedCombatants.length === 0) {
      return
    }

    const firstCombatantId = sortedCombatants[0].id
    const now = Date.now()

    setTurnHistory([])
    setTurnStartTime(now)
    setIsStatsVisible(false)
    setActiveCombatantId(firstCombatantId)
  }

  const handleAdvanceTurn = () => {
    if (sortedCombatants.length === 0) {
      return
    }

    if (!isCombatActive) {
      handleStartCombat()
      return
    }

    const currentIndex = sortedCombatants.findIndex(
      (combatant) => combatant.id === activeCombatantId,
    )
    const nextIndex =
      currentIndex === -1 || currentIndex === sortedCombatants.length - 1
        ? 0
        : currentIndex + 1

    recordTurnDuration()

    setTurnStartTime(Date.now())
    setActiveCombatantId(sortedCombatants[nextIndex].id)
  }

  const handleEndCombat = () => {
    if (!isCombatActive) {
      return
    }

    const finalHistory = recordTurnDuration()
    const stats = computeCombatStats(finalHistory)

    setActiveCombatantId(null)
    setTurnStartTime(null)
    setTurnHistory([])
    setLastCombatStats(stats)
    setIsStatsVisible(true)
  }

  const currentTurnElapsed =
    isCombatActive && turnStartTime !== null ? currentTime - turnStartTime : 0
  const turnsRecorded = turnHistory.length
  const shouldShowStats = isStatsVisible && lastCombatStats
  const hasStatsToShow = Boolean(lastCombatStats)

  const handleDownloadState = () => {
    const state = store.getState()
    const data = JSON.stringify(state, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const now = new Date()
    const pad = (value) => String(value).padStart(2, '0')
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
      now.getDate(),
    )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const filename = `DNDdata-${timestamp}.json`

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()

    URL.revokeObjectURL(url)
  }

  const handleUploadClick = () => {
    setLoadError('')
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileInputChange = (event) => {
    const [file] = event.target.files || []

    if (!file) {
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''

      if (!text) {
        setLoadError('Failed to load file. Please select a valid DNDdata file.')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        return
      }

      try {
        const parsed = JSON.parse(text)
        let hasValidData = false

        if (parsed && typeof parsed === 'object') {
          if (parsed.combat && typeof parsed.combat === 'object') {
            dispatch(loadCombatStateAction(parsed.combat))
            hasValidData = true
          } else if (Array.isArray(parsed.combatants)) {
            dispatch(loadCombatStateAction({ combatants: parsed.combatants }))
            hasValidData = true
          }

          if (parsed.campaigns && typeof parsed.campaigns === 'object') {
            dispatch(loadCampaignStateAction(parsed.campaigns))
            hasValidData = true
          } else if (
            parsed.combat &&
            typeof parsed.combat === 'object' &&
            Array.isArray(parsed.combat.playerTemplates)
          ) {
            const legacyCampaignPayload = {
              campaigns:
                parsed.combat.playerTemplates.length > 0
                  ? [
                      {
                        id: 'legacy-import',
                        name: 'Imported roster',
                        notes: '',
                        createdAt: Date.now(),
                        playerCharacters: parsed.combat.playerTemplates,
                      },
                    ]
                  : [],
              activeCampaignId:
                parsed.combat.playerTemplates.length > 0 ? 'legacy-import' : null,
            }
            dispatch(loadCampaignStateAction(legacyCampaignPayload))
            hasValidData = true
          } else if (hasValidData) {
            dispatch(
              loadCampaignStateAction({ campaigns: [], activeCampaignId: null }),
            )
          }

          if (parsed.monsterLibrary && typeof parsed.monsterLibrary === 'object') {
            dispatch(loadMonsterLibraryStateAction(parsed.monsterLibrary))
            hasValidData = true
          } else if (hasValidData) {
            dispatch(loadMonsterLibraryStateAction({}))
          }
        }

        if (hasValidData) {
          setActiveCombatantId(null)
          setTurnStartTime(null)
          setTurnHistory([])
          setIsStatsVisible(false)
          setLoadError('')
        } else {
          setLoadError('The selected file does not contain recognizable assistant data.')
        }
      } catch (error) {
        console.error('Failed to parse uploaded state file', error)
        setLoadError('Failed to load file. Please select a valid DNDdata file.')
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }

    reader.onerror = () => {
      setLoadError('Failed to read the selected file.')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }

    reader.readAsText(file)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="sidebar__header">
          <h1>TTRP campaign assistant</h1>
          <p>Your party control room</p>
        </header>
        <nav className="sidebar__nav">
          <span className="sidebar__section">Campaign Tools</span>
          <ul>
            <li>
              <button
                type="button"
                className={`sidebar__item${activeView === 'initiative' ? ' sidebar__item--active' : ''}`}
                onClick={() => setActiveView('initiative')}
              >
                Initiative Tracker
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar__item${activeView === 'campaigns' ? ' sidebar__item--active' : ''}`}
                onClick={() => setActiveView('campaigns')}
              >
                Campaign Manager
              </button>
            </li>
            <li>
              <span className="sidebar__item sidebar__item--disabled">Quest Log (coming soon)</span>
            </li>
            <li>
              <span className="sidebar__item sidebar__item--disabled">Treasure Ledger (coming soon)</span>
            </li>
          </ul>
        </nav>
        <div className="sidebar__global-actions">
          <span className="sidebar__section">Data management</span>
          <div className="save-load-controls">
            <div className="save-load-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={handleDownloadState}
              >
                Download state
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={handleUploadClick}
              >
                Upload state
              </button>
            </div>
            {loadError && <p className="load-error">{loadError}</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="visually-hidden"
              onChange={handleFileInputChange}
            />
          </div>
        </div>
        <footer className="sidebar__footer">
          <p>Forged for D&D tables that crave order in the chaos.</p>
        </footer>
      </aside>

      <main className="main">
        <section className="main__header">
          <div>
            <h2>{activeHeader.title}</h2>
            <p>{activeHeader.description}</p>
          </div>
          <div className="header-actions">
            {activeView === 'campaigns' ? (
              <div className="campaign-summary">
                <div className="summary-card">
                  <span className="summary__label">Campaigns</span>
                  <span className="summary__value">{campaigns.length}</span>
                </div>
                <div className="summary-card">
                  <span className="summary__label">Saved heroes</span>
                  <span className="summary__value">{totalSavedCharacters}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="initiative-summary">
                  <span className="summary__label">Creatures</span>
                  <span className="summary__value">{combatants.length}</span>
                </div>
                {hasStatsToShow && !shouldShowStats && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setIsStatsVisible(true)}
                  >
                    View last combat stats
                  </button>
                )}
              </>
            )}
          </div>
        </section>
        {activeView === 'campaigns' && (
          <section className="campaign-section">
            <header className="campaign-section__header">
              <div>
                <h3>Campaign manager</h3>
                <p>
                  Organize multiple campaigns, craft notes, and maintain reusable party
                  rosters.
                </p>
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
                      onChange={(event) =>
                        handleCampaignFormChange('name', event.target.value)
                      }
                      placeholder="Rime of the Frostmaiden"
                    />
                  </label>
                  {campaignFormError && (
                    <p className="form-error">{campaignFormError}</p>
                  )}
                  <button type="submit" className="primary-button">
                    Create campaign
                  </button>
                </form>
              </div>
              <div className="campaign-manager__content">
                {activeCampaign ? (
                  <>
                    <form className="campaign-details" onSubmit={handleSaveCampaignDetails}>
                      <div className="campaign-details__header">
                        <h4>Campaign details</h4>
                        <button type="submit" className="secondary-button">
                          Save details
                        </button>
                      </div>
                      <div className="form-grid campaign-form__grid">
                        <label>
                          <span>Name</span>
                          <input
                            value={campaignDetailsDraft.name}
                            onChange={(event) =>
                              handleCampaignDetailsChange('name', event.target.value)
                            }
                            placeholder="Storm King's Thunder"
                          />
                        </label>
                        <label className="campaign-form__notes">
                          <span>Notes</span>
                          <textarea
                            value={campaignDetailsDraft.notes}
                            onChange={(event) =>
                              handleCampaignDetailsChange('notes', event.target.value)
                            }
                            placeholder="Session prep, world lore, or loot ideas."
                            rows={3}
                          />
                        </label>
                      </div>
                      {campaignDetailsError && (
                        <p className="form-error">{campaignDetailsError}</p>
                      )}
                    </form>

                    <form className="campaign-form" onSubmit={handleAddPlayerTemplate}>
                      <h4>Create player character</h4>
                      <div className="form-grid campaign-form__grid">
                        <label>
                          <span>Name</span>
                          <input
                            value={playerTemplateForm.name}
                            onChange={(event) =>
                              handlePlayerTemplateFormChange('name', event.target.value)
                            }
                            placeholder="Elowen Nightbloom"
                          />
                        </label>
                        <label>
                          <span>Max HP</span>
                          <input
                            value={playerTemplateForm.maxHp}
                            onChange={(event) =>
                              handlePlayerTemplateFormChange('maxHp', event.target.value)
                            }
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
                            placeholder="16"
                            inputMode="numeric"
                          />
                        </label>
                        <label className="campaign-form__notes">
                          <span>Notes</span>
                          <textarea
                            value={playerTemplateForm.notes}
                            onChange={(event) =>
                              handlePlayerTemplateFormChange('notes', event.target.value)
                            }
                            placeholder="Personality, spell slots, reminders..."
                            rows={3}
                          />
                        </label>
                      </div>
                      {playerTemplateError && (
                        <p className="form-error">{playerTemplateError}</p>
                      )}
                      <div className="campaign-form__actions">
                        <button type="submit" className="primary-button">
                          Add to roster
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={resetPlayerTemplateForm}
                        >
                          Clear
                        </button>
                      </div>
                    </form>

                    <div className="campaign-roster">
                      <div className="campaign-roster__header">
                        <h4>Saved player characters</h4>
                        <p>Reuse your heroes across sessions with a single click.</p>
                      </div>
                      {activeCampaignRoster.length === 0 ? (
                        <div className="campaign-roster__empty">
                          <p>
                            No heroes saved yet. Chronicle your party above to reuse them across
                            encounters.
                          </p>
                        </div>
                      ) : (
                        <ul className="template-list">
                          {activeCampaignRoster.map((template) => (
                            <li key={template.id} className="template-card">
                              <header className="template-card__header">
                                <div>
                                  <h5>{template.name}</h5>
                                  <div className="template-card__stats">
                                    <span className="stat-chip">Max HP {template.maxHp}</span>
                                    {template.armorClass !== null && (
                                      <span className="stat-chip">AC {template.armorClass}</span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => handleRemovePlayerTemplate(template.id)}
                                >
                                  Remove
                                </button>
                              </header>
                              {template.notes && (
                                <p className="template-card__notes">{template.notes}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <form className="campaign-form" onSubmit={handleImportMonster}>
                      <h4>Import monster from D&D Beyond</h4>
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
                      {monsterImportSuccess && (
                        <p className="form-success">{monsterImportSuccess}</p>
                      )}
                      <div className="campaign-form__actions">
                        <button type="submit" className="primary-button" disabled={isMonsterImporting}>
                          {isMonsterImporting ? 'Importing…' : 'Import monster'}
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => {
                            setMonsterImportUrl('')
                            setMonsterImportError('')
                            setMonsterImportSuccess('')
                          }}
                          disabled={isMonsterImporting}
                        >
                          Clear
                        </button>
                      </div>
                      <p className="form-hint">
                        The tracker fetches a reader-friendly version of the stat block via r.jina.ai.
                      </p>
                    </form>

                    <div className="monster-library">
                      <div className="monster-library__header">
                        <h4>Campaign monsters</h4>
                        <p>Keep your frequently used foes ready for quick initiative drops.</p>
                      </div>
                      {campaignMonsterList.length === 0 ? (
                        <div className="monster-library__empty">
                          <p>No monsters imported yet. Paste a D&D Beyond URL above to add one.</p>
                        </div>
                      ) : (
                        <ul className="monster-library__list">
                          {campaignMonsterList.map(({ monster, entry, isFavorite }) => {
                            const initiativeValue = monsterInitiatives[monster.id] ?? ''
                            const displayTags = buildDisplayTags(monster.tags)

                            const lastUsedLabel = entry.lastUsedAt
                              ? new Date(entry.lastUsedAt).toLocaleString()
                              : null

                            const editDraft = monsterEdits[monster.id]
                              ? monsterEdits[monster.id]
                              : null
                            const isEditing = Boolean(editDraft)

                            return (
                              <li key={monster.id} className="template-card monster-card">
                                <header className="template-card__header monster-card__header">
                                  <div>
                                    <h5>{monster.name}</h5>
                                    {displayTags.length > 0 && (
                                      <div className="template-card__stats monster-card__stats">
                                        {displayTags.map((tag, tagIndex) => (
                                          <span
                                            key={tag.id || `${tag.label}-${tagIndex}`}
                                            className="stat-chip"
                                          >
                                            {tag.label}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="monster-card__header-actions">
                                    <button
                                      type="button"
                                      className={`ghost-button monster-card__favorite-button${
                                        isFavorite ? ' monster-card__favorite-button--active' : ''
                                      }`}
                                      onClick={() => handleToggleMonsterFavoriteClick(monster.id)}
                                    >
                                      {isFavorite ? '★ Favorite' : '☆ Favorite'}
                                    </button>
                                    <button
                                      type="button"
                                      className="ghost-button"
                                      onClick={() => handleStartMonsterEdit(monster)}
                                    >
                                      {isEditing ? 'Editing…' : 'Edit details'}
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
                                    <label className="monster-card__edit-name">
                                      <span>Name</span>
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
                                    <div className="monster-card__edit-tags">
                                      <span>Tags</span>
                                      {Array.isArray(editDraft.tags) && editDraft.tags.length > 0 && (
                                        <div className="monster-card__tag-list">
                                          {editDraft.tags.map((tag, tagIndex) => {
                                            if (!tag || !tag.label) {
                                              return null
                                            }
                                            const canRemove =
                                              tag.key !== 'hp' &&
                                              tag.key !== 'ac' &&
                                              tag.removable !== false
                                            const tagKey = tag.id || `${tag.label}-${tagIndex}`
                                            return (
                                              <span key={tagKey} className="monster-card__tag">
                                                {tag.label}
                                                {canRemove && (
                                                  <button
                                                    type="button"
                                                    className="monster-card__tag-remove"
                                                    onClick={() => handleMonsterTagRemove(monster.id, tag)}
                                                    aria-label={`Remove tag ${tag.label}`}
                                                  >
                                                    ×
                                                  </button>
                                                )}
                                              </span>
                                            )
                                          })}
                                        </div>
                                      )}
                                      <div className="monster-card__tag-input">
                                        <input
                                          value={typeof editDraft.newTag === 'string' ? editDraft.newTag : ''}
                                          onChange={(event) =>
                                            handleMonsterTagDraftChange(
                                              monster.id,
                                              event.target.value,
                                            )
                                          }
                                          onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                              event.preventDefault()
                                              handleMonsterTagAdd(monster.id)
                                            }
                                          }}
                                          placeholder="Add a tag like 'Resist Fire' or 'Spellcaster'"
                                          autoComplete="off"
                                        />
                                        <button
                                          type="button"
                                          className="ghost-button"
                                          onClick={() => handleMonsterTagAdd(monster.id)}
                                          disabled={
                                            !editDraft.newTag ||
                                            (typeof editDraft.newTag === 'string' &&
                                              !editDraft.newTag.trim())
                                          }
                                        >
                                          Add tag
                                        </button>
                                      </div>
                                      {editDraft.tagError && (
                                        <p className="monster-card__tag-error">{editDraft.tagError}</p>
                                      )}
                                    </div>
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
                                    {editDraft.error && (
                                      <p className="template-card__error">{editDraft.error}</p>
                                    )}
                                    <div className="monster-card__edit-actions">
                                      <button type="submit" className="primary-button">
                                        Save changes
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
                                  Array.isArray(monster.description) &&
                                  monster.description.length > 0 && (
                                    <div className="monster-card__description">
                                      {monster.description.map((paragraph, paragraphIndex) => (
                                        <p key={paragraphIndex}>{paragraph}</p>
                                      ))}
                                    </div>
                                  )
                                )}
                                <div className="template-card__actions monster-card__actions">
                                  <label className="template-card__initiative">
                                    <span>Initiative</span>
                                    <input
                                      value={initiativeValue}
                                      onChange={(event) =>
                                        handleMonsterInitiativeChange(
                                          monster.id,
                                          event.target.value,
                                        )
                                      }
                                      placeholder="0"
                                      inputMode="numeric"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => handleQuickAddMonster(monster.id, activeCampaign.id)}
                                  >
                                    Add to initiative
                                  </button>
                                </div>
                                {monsterErrors[monster.id] && (
                                  <p className="template-card__error">{monsterErrors[monster.id]}</p>
                                )}
                                <footer className="monster-card__footer">
                                  <div className="monster-card__usage">
                                    <span>
                                      Used {entry.usageCount}{' '}
                                      {entry.usageCount === 1 ? 'time' : 'times'}
                                    </span>
                                    {lastUsedLabel && <span>Last used {lastUsedLabel}</span>}
                                  </div>
                                  {monster.sourceUrl && (
                                    <a
                                      href={monster.sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="monster-card__link"
                                    >
                                      View on D&amp;D Beyond
                                    </a>
                                  )}
                                </footer>
                              </li>
                            )
                          })}
                        </ul>
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
        )}

        {activeView === 'initiative' &&
          (shouldShowStats ? (
            <section className="combat-stats">
              <header className="combat-stats__header">
                <div>
                  <h3>Combat statistics</h3>
                  <p>Review timing insights from the last initiative.</p>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setIsStatsVisible(false)}
                >
                  Back to tracker
                </button>
              </header>
              {lastCombatStats.totalTurns === 0 ? (
                <div className="combat-stats__empty">
                  <p>No turn timing data was captured for the last combat.</p>
                </div>
              ) : (
                <>
                  <div className="combat-stats__summary">
                    <div className="combat-stats__summary-card">
                      <span className="combat-stats__summary-label">
                        Total combat time
                      </span>
                      <span className="combat-stats__summary-value">
                        {formatDurationClock(lastCombatStats.totalDuration)}
                      </span>
                    </div>
                    <div className="combat-stats__summary-card">
                      <span className="combat-stats__summary-label">Average turn</span>
                      <span className="combat-stats__summary-value">
                        {formatDurationVerbose(lastCombatStats.averageTurnDuration)}
                      </span>
                      <span className="combat-stats__summary-hint">
                        {lastCombatStats.totalTurns} turns
                      </span>
                    </div>
                    {lastCombatStats.longestTurnEntry && (
                      <div className="combat-stats__summary-card">
                        <span className="combat-stats__summary-label">
                          Longest turn
                        </span>
                        <span className="combat-stats__summary-value">
                          {formatDurationVerbose(
                            lastCombatStats.longestTurnEntry.duration,
                          )}
                        </span>
                        <span className="combat-stats__summary-hint">
                          {lastCombatStats.longestTurnEntry.combatantName}
                        </span>
                      </div>
                    )}
                    {lastCombatStats.fastestTurnEntry && (
                      <div className="combat-stats__summary-card">
                        <span className="combat-stats__summary-label">
                          Quickest turn
                        </span>
                        <span className="combat-stats__summary-value">
                          {formatDurationVerbose(
                            lastCombatStats.fastestTurnEntry.duration,
                          )}
                        </span>
                        <span className="combat-stats__summary-hint">
                          {lastCombatStats.fastestTurnEntry.combatantName}
                        </span>
                      </div>
                    )}
                    {lastCombatStats.slowestAverage && (
                      <div className="combat-stats__summary-card">
                        <span className="combat-stats__summary-label">
                          Slowest average
                        </span>
                        <span className="combat-stats__summary-value">
                          {formatDurationVerbose(
                            lastCombatStats.slowestAverage.averageDuration,
                          )}
                        </span>
                        <span className="combat-stats__summary-hint">
                          {lastCombatStats.slowestAverage.name}
                        </span>
                      </div>
                    )}
                    {lastCombatStats.quickestAverage && (
                      <div className="combat-stats__summary-card">
                        <span className="combat-stats__summary-label">
                          Quickest average
                        </span>
                        <span className="combat-stats__summary-value">
                          {formatDurationVerbose(
                            lastCombatStats.quickestAverage.averageDuration,
                          )}
                        </span>
                        <span className="combat-stats__summary-hint">
                          {lastCombatStats.quickestAverage.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="combat-stats__table">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Combatant</th>
                          <th scope="col">Turns</th>
                          <th scope="col">Avg turn</th>
                          <th scope="col">Longest</th>
                          <th scope="col">Total time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastCombatStats.combatantStats.map((entry) => (
                          <tr key={entry.combatantId}>
                            <td>{entry.name}</td>
                            <td>{entry.turnCount}</td>
                            <td>{formatDurationClock(entry.averageDuration)}</td>
                            <td>{formatDurationClock(entry.longestTurn)}</td>
                            <td>{formatDurationClock(entry.totalDuration)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          ) : (
            <>
          <section className="tracker">
            <form className="tracker__form" onSubmit={handleAddCombatant}>
              <h3>Add a combatant</h3>
              <div className="form-grid">
                <label>
                  <span>Name</span>
                <input
                  value={formData.name}
                  onChange={(event) => handleFormChange('name', event.target.value)}
                  placeholder="Goblin Sentry"
                  autoComplete="off"
                />
              </label>
              <label>
                <span>Type</span>
                <select
                  value={formData.type}
                  onChange={(event) => handleFormChange('type', event.target.value)}
                >
                  <option value="player">Player</option>
                  <option value="monster">Monster</option>
                </select>
              </label>
              <label>
                <span>Max HP</span>
                <input
                  value={formData.maxHp}
                  onChange={(event) => handleFormChange('maxHp', event.target.value)}
                  placeholder="12"
                  inputMode="numeric"
                />
              </label>
              <label>
                <span>Initiative</span>
                <input
                  value={formData.initiative}
                  onChange={(event) =>
                    handleFormChange('initiative', event.target.value)
                  }
                  placeholder="15"
                  inputMode="numeric"
                />
              </label>
            </div>
            {formError && <p className="form-error">{formError}</p>}
            <button type="submit" className="primary-button">
              Add to order
            </button>
            </form>

            <div className="tracker__list">
              <div className="list-controls">
                <div className="list-controls__info">
                  <h3>Initiative order</h3>
                  <div className="turn-tracking">
                    <div className="turn-timer" aria-live="polite">
                      <span className="turn-timer__label">
                        {isCombatActive ? 'Current turn' : 'Turn timer'}
                      </span>
                      <span className="turn-timer__value">
                        {formatDurationClock(currentTurnElapsed)}
                      </span>
                    </div>
                    <div className="turn-counter">
                      <span className="turn-counter__label">Turns logged</span>
                      <span className="turn-counter__value">{turnsRecorded}</span>
                    </div>
                  </div>
                </div>
                <div className="list-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleStartCombat}
                    disabled={sortedCombatants.length === 0}
                  >
                    Start combat
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleAdvanceTurn}
                    disabled={sortedCombatants.length === 0 || !isCombatActive}
                  >
                    Next turn
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleEndCombat}
                    disabled={!isCombatActive}
                  >
                    End combat
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={handleClearMonsters}
                    disabled={!hasMonsters}
                  >
                    Clear monsters
                  </button>
                </div>
              </div>
              {sortedCombatants.length === 0 ? (
                <div className="empty-state">
                  <h3>No combatants yet</h3>
                  <p>
                    Gather your adventurers and foes above. They will march into
                  the initiative order as soon as you add them.
                </p>
              </div>
            ) : (
              <ul className="combatant-list">
                {sortedCombatants.map((combatant, index) => {
                  const adjustment = adjustments[combatant.id] ?? ''
                  const initiativeEntry = initiativeDrafts[combatant.id]
                  const initiativeValue =
                    initiativeEntry?.value ?? String(combatant.initiative)
                  const isDown = combatant.currentHp === 0
                  const hpPercent = Math.round(
                    (combatant.currentHp / combatant.maxHp) * 100,
                  )

                  const typeClassName =
                    combatant.type === 'player'
                      ? 'combatant-card--player'
                      : 'combatant-card--monster'
                  const isActive = combatant.id === activeCombatantId
                  const isBloodied =
                    combatant.currentHp > 0 &&
                    combatant.currentHp <= combatant.maxHp / 2

                  return (
                    <li
                      key={combatant.id}
                      className={`combatant-card ${typeClassName} ${
                        isActive ? 'combatant-card--active' : ''
                      }`}
                    >
                      <header className="combatant-card__header">
                        <div className="combatant-card__initiative">
                          {isActive && (
                            <span
                              className="turn-indicator"
                              role="img"
                              aria-label="Current turn"
                            >
                              ⭐
                            </span>
                          )}
                          <span className="initiative-rank">#{index + 1}</span>
                          <label className="initiative-editor">
                            <span className="initiative-editor__caption">
                              Initiative
                            </span>
                            <input
                              className="initiative-editor__input"
                              value={initiativeValue}
                              onChange={(event) =>
                                handleInitiativeDraftChange(
                                  combatant.id,
                                  event.target.value,
                                )
                              }
                              onBlur={() => commitInitiativeChange(combatant.id)}
                              onKeyDown={(event) =>
                                handleInitiativeKeyDown(event, combatant.id)
                              }
                              placeholder="0"
                              inputMode="numeric"
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handleRemoveCombatant(combatant.id)}
                        >
                          Remove
                        </button>
                      </header>

                      <div className="combatant-card__body">
                        <div className="combatant-card__details">
                          <div className="combatant-card__title">
                            <h4 className="combatant-name">{combatant.name}</h4>
                            <span
                              className={`combatant-type-badge combatant-type-badge--${combatant.type}`}
                            >
                              {combatant.type === 'player' ? 'Player' : 'Monster'}
                            </span>
                            {isBloodied && (
                              <span
                                className="bloodied-indicator"
                                title="Bloodied"
                                aria-label="Bloodied"
                              >
                                <span aria-hidden="true">🩸</span>
                              </span>
                            )}
                          </div>
                          <div className="hp-track">
                            <div className="hp-track__bar">
                              <span
                                className="hp-track__fill"
                                style={{ width: `${hpPercent}%` }}
                              />
                            </div>
                            <span
                              className={`hp-track__value ${
                                isDown ? 'hp-track__value--down' : ''
                              }`}
                            >
                              {combatant.currentHp} / {combatant.maxHp} HP
                            </span>
                          </div>
                          <div className="combatant-card__meta">
                            {combatant.armorClass !== null && (
                              <span className="combatant-card__meta-item">
                                AC {combatant.armorClass}
                              </span>
                            )}
                            {combatant.sourceTemplateId && (
                              <span className="combatant-card__meta-item combatant-card__meta-item--tag">
                                Roster
                              </span>
                            )}
                          </div>
                          {combatant.notes && (
                            <p className="combatant-card__notes">{combatant.notes}</p>
                          )}
                          {isDown && (
                            <p className="status status--down">Unconscious</p>
                          )}
                        </div>

                        <div className="combatant-card__actions">
                          <label>
                            <span>Adjust HP</span>
                            <input
                              value={adjustment}
                              onChange={(event) =>
                                handleAdjustmentChange(
                                  combatant.id,
                                  event.target.value,
                                )
                              }
                              placeholder="5"
                              inputMode="numeric"
                            />
                          </label>
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="danger-button"
                              onClick={() => applyAdjustment(combatant.id, 'damage')}
                            >
                              Apply damage
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => applyAdjustment(combatant.id, 'heal')}
                            >
                              Apply healing
                            </button>
                          </div>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => handleResetCombatant(combatant.id)}
                          >
                            Reset HP
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="initiative-campaign">
          <header className="initiative-campaign__header">
            <div>
              <h3>Pull from campaign roster</h3>
              <p>Choose a campaign and drop ready-made heroes straight into initiative.</p>
            </div>
            <div className="initiative-campaign__controls">
              <label>
                <span>Campaign</span>
                <select
                  value={activeCampaign ? activeCampaign.id : ''}
                  onChange={(event) => {
                    const nextId = event.target.value
                    if (!nextId) {
                      return
                    }
                    handleSelectCampaign(nextId)
                  }}
                >
                  <option value="" disabled>
                    {sortedCampaigns.length === 0
                      ? 'No campaigns available'
                      : 'Select campaign'}
                  </option>
                  {sortedCampaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setActiveView('campaigns')}
              >
                Manage campaigns
              </button>
            </div>
          </header>
          {activeCampaign ? (
            activeCampaignRoster.length === 0 ? (
              <div className="initiative-campaign__empty">
                <p>
                  No heroes saved for {activeCampaign.name}. Add them in the campaign manager.
                </p>
              </div>
            ) : (
              <ul className="template-list">
                {activeCampaignRoster.map((template) => {
                  const initiativeValue = templateInitiatives[template.id] ?? ''
                  return (
                    <li key={template.id} className="template-card">
                      <header className="template-card__header">
                        <div>
                          <h5>{template.name}</h5>
                          <div className="template-card__stats">
                            <span className="stat-chip">Max HP {template.maxHp}</span>
                            {template.armorClass !== null && (
                              <span className="stat-chip">AC {template.armorClass}</span>
                            )}
                          </div>
                        </div>
                      </header>
                      {template.notes && (
                        <p className="template-card__notes">{template.notes}</p>
                      )}
                      <div className="template-card__actions">
                        <label className="template-card__initiative">
                          <span>Initiative</span>
                          <input
                            value={initiativeValue}
                            onChange={(event) =>
                              handleTemplateInitiativeChange(template.id, event.target.value)
                            }
                            placeholder="0"
                            inputMode="numeric"
                          />
                        </label>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleQuickAddFromTemplate(template.id)}
                        >
                          Add to initiative
                        </button>
                      </div>
                      {templateErrors[template.id] && (
                        <p className="template-card__error">{templateErrors[template.id]}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )
          ) : (
            <div className="initiative-campaign__empty">
              <p>Create a campaign to quickly load recurring party members.</p>
            </div>
          )}
        </section>

        <section className="initiative-monsters">
          <header className="initiative-monsters__header">
            <div>
              <h3>Campaign bestiary</h3>
              <p>Drop imported monsters into combat with a single click.</p>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setActiveView('campaigns')}
            >
              Manage monsters
            </button>
          </header>
          {!activeCampaign ? (
            <div className="initiative-monsters__empty">
              <p>Select a campaign to access its monsters.</p>
            </div>
          ) : campaignMonsterList.length === 0 ? (
            <div className="initiative-monsters__empty">
              <p>Import monsters in the campaign manager to build your bestiary.</p>
            </div>
          ) : (
            <ul className="monster-quick-list">
              {campaignMonsterList.map(({ monster, isFavorite }) => {
                const initiativeValue = monsterInitiatives[monster.id] ?? ''
                const displayTags = buildDisplayTags(monster.tags)
                const quickTags = displayTags.slice(0, 4)

                return (
                  <li key={monster.id} className="template-card monster-card monster-card--compact">
                    <header className="template-card__header monster-card__header">
                      <div>
                        <h5>{monster.name}</h5>
                        {quickTags.length > 0 && (
                          <div className="template-card__stats monster-card__stats">
                            {quickTags.map((tag, tagIndex) => (
                              <span
                                key={tag.id || `${tag.label}-${tagIndex}`}
                                className="stat-chip"
                              >
                                {tag.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className={`ghost-button monster-card__favorite-button${
                          isFavorite ? ' monster-card__favorite-button--active' : ''
                        }`}
                        onClick={() => handleToggleMonsterFavoriteClick(monster.id)}
                      >
                        {isFavorite ? '★ Favorite' : '☆ Favorite'}
                      </button>
                    </header>
                    <div className="template-card__actions monster-card__actions">
                      <label className="template-card__initiative">
                        <span>Initiative</span>
                        <input
                          value={initiativeValue}
                          onChange={(event) =>
                            handleMonsterInitiativeChange(monster.id, event.target.value)
                          }
                          placeholder="0"
                          inputMode="numeric"
                        />
                      </label>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleQuickAddMonster(monster.id, activeCampaign.id)}
                      >
                        Add monster
                      </button>
                    </div>
                    {monsterErrors[monster.id] && (
                      <p className="template-card__error">{monsterErrors[monster.id]}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="initiative-favorites">
          <header className="initiative-favorites__header">
            <div>
              <h3>Favorite monsters</h3>
              <p>Access your starred creatures from any campaign.</p>
            </div>
          </header>
          {favoriteMonsterList.length === 0 ? (
            <div className="initiative-favorites__empty">
              <p>Mark campaign monsters as favorites to reuse them here.</p>
            </div>
          ) : (
            <ul className="monster-quick-list">
              {favoriteMonsterList.map(({ monster }) => {
                const initiativeValue = monsterInitiatives[monster.id] ?? ''
                const displayTags = buildDisplayTags(monster.tags)
                const quickTags = displayTags.slice(0, 4)

                return (
                  <li key={monster.id} className="template-card monster-card monster-card--compact">
                    <header className="template-card__header monster-card__header">
                      <div>
                        <h5>{monster.name}</h5>
                        {quickTags.length > 0 && (
                          <div className="template-card__stats monster-card__stats">
                            {quickTags.map((tag, tagIndex) => (
                              <span
                                key={tag.id || `${tag.label}-${tagIndex}`}
                                className="stat-chip"
                              >
                                {tag.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="ghost-button monster-card__favorite-button monster-card__favorite-button--active"
                        onClick={() => handleToggleMonsterFavoriteClick(monster.id)}
                      >
                        ★ Favorite
                      </button>
                    </header>
                    <div className="template-card__actions monster-card__actions">
                      <label className="template-card__initiative">
                        <span>Initiative</span>
                        <input
                          value={initiativeValue}
                          onChange={(event) =>
                            handleMonsterInitiativeChange(monster.id, event.target.value)
                          }
                          placeholder="0"
                          inputMode="numeric"
                        />
                      </label>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleQuickAddMonster(monster.id, activeCampaign ? activeCampaign.id : null)}
                      >
                        Add monster
                      </button>
                    </div>
                    {monsterErrors[monster.id] && (
                      <p className="template-card__error">{monsterErrors[monster.id]}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </>
    ))}
      </main>
    </div>
  )
}

export default App

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  addCombatant as addCombatantAction,
  applyDamage as applyDamageAction,
  applyHealing as applyHealingAction,
  removeCombatant as removeCombatantAction,
  resetCombatant as resetCombatantAction,
  updateInitiative as updateInitiativeAction,
  clearMonsters as clearMonstersAction,
  setCombatantTag as setCombatantTagAction,
} from '../../store/combatSlice'
import {
  removePlayerCharacter as removePlayerCharacterAction,
  setActiveCampaign as setActiveCampaignAction,
} from '../../store/campaignSlice'
import {
  recordMonsterUsage as recordMonsterUsageAction,
  toggleMonsterFavorite as toggleMonsterFavoriteAction,
} from '../../store/monsterLibrarySlice'
import { formatDurationClock, formatDurationVerbose, computeCombatStats } from '../../utils/combatStats'
import { getMonsterDisplayTags } from '../../utils/monsterTags'
import { generateFantasyName } from '../../utils/nameGenerator'
import { CombatantList } from './CombatantList'
import type { AdjustmentDraft, DamageModifier, ValueDraft } from './types'
import type {
  Campaign,
  CampaignCharacter,
  Combatant,
  MonsterDetails,
  MonsterLibraryEntry,
  RootState,
  TurnHistoryEntry,
  CombatStatsSummary,
} from '../../types'
import type { AppDispatch } from '../../store'

interface InitiativeViewProps {
  onNavigateToCampaigns: () => void
  resetKey: number
}

interface FormDataState {
  name: string
  maxHp: string
  initiative: string
  type: 'player' | 'monster'
}

const createDefaultAdjustmentDraft = (): AdjustmentDraft => ({
  value: '',
  damageModifier: 'normal',
})

/**
 * Hosts the initiative tracker workflow, including combat timing and quick-add helpers.
 */
export const InitiativeView: React.FC<InitiativeViewProps> = ({ onNavigateToCampaigns, resetKey }) => {
  const dispatch = useDispatch<AppDispatch>()
  const combatants = useSelector((state: RootState) => state.combat.combatants)
  const campaigns = useSelector((state: RootState) => state.campaigns.campaigns)
  const activeCampaignId = useSelector((state: RootState) => state.campaigns.activeCampaignId)
  const monsterLibrary = useSelector((state: RootState) => state.monsterLibrary)

  const [formData, setFormData] = useState<FormDataState>({
    name: '',
    maxHp: '',
    initiative: '',
    type: 'player',
  })
  const [formError, setFormError] = useState('')
  const [adjustments, setAdjustments] = useState<Record<string, AdjustmentDraft>>({})
  const [initiativeDrafts, setInitiativeDrafts] = useState<Record<string, ValueDraft>>({})
  const [activeCombatantId, setActiveCombatantId] = useState<string | null>(null)
  const [turnHistory, setTurnHistory] = useState<TurnHistoryEntry[]>([])
  const [turnStartTime, setTurnStartTime] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [isStatsVisible, setIsStatsVisible] = useState(false)
  const [lastCombatStats, setLastCombatStats] = useState<CombatStatsSummary | null>(null)
  const [templateInitiatives, setTemplateInitiatives] = useState<Record<string, string>>({})
  const [templateErrors, setTemplateErrors] = useState<Record<string, string>>({})
  const [monsterInitiatives, setMonsterInitiatives] = useState<Record<string, string>>({})
  const [monsterErrors, setMonsterErrors] = useState<Record<string, string>>({})

  /**
   * Provides access to the currently active campaign object.
   */
  const activeCampaign = useMemo<Campaign | null>(() => {
    return campaigns.find((campaign) => campaign.id === activeCampaignId) || null
  }, [campaigns, activeCampaignId])

  /**
   * Supplies a stable order for campaigns in dropdowns.
   */
  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => a.createdAt - b.createdAt)
  }, [campaigns])

  /**
   * Lists the roster for the active campaign in creation order.
   */
  const activeCampaignRoster = useMemo<CampaignCharacter[]>(() => {
    if (!activeCampaign) {
      return []
    }
    return [...activeCampaign.playerCharacters].sort((a, b) => a.createdAt - b.createdAt)
  }, [activeCampaign])

  /**
   * Orders combatants by initiative and creation time for turn sequencing.
   */
  const sortedCombatants = useMemo(() => {
    return [...combatants].sort((a, b) => {
      if (b.initiative === a.initiative) {
        return a.createdAt - b.createdAt
      }
      return b.initiative - a.initiative
    })
  }, [combatants])

  /**
   * Builds a list of campaign monsters with metadata used in the UI.
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
   * Prepares the list of favorite monsters regardless of campaign linkage.
   */
  const favoriteMonsterList = useMemo(() => {
    if (!monsterLibrary || !Array.isArray(monsterLibrary.favorites)) {
      return [] as Array<{
        monster: MonsterDetails
        isInActiveCampaign: boolean
      }>
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

        const isInActiveCampaign = activeLibrary.some((entry) => entry.monsterId === monsterId)

        return {
          monster,
          isInActiveCampaign,
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const usageA = a!.monster.totalUsageCount || 0
        const usageB = b!.monster.totalUsageCount || 0

        if (usageA !== usageB) {
          return usageB - usageA
        }

        const updatedA = a!.monster.updatedAt || 0
        const updatedB = b!.monster.updatedAt || 0
        return updatedB - updatedA
      }) as Array<{
      monster: MonsterDetails
      isInActiveCampaign: boolean
    }>
  }, [monsterLibrary, activeCampaign])

  /**
   * Tracks which monster IDs should maintain initiative state in quick-add lists.
   */
  const visibleMonsterIds = useMemo(() => {
    const ids: string[] = []
    const seen = new Set<string>()

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

  /**
   * Determines how long the current turn has been active in milliseconds.
   */
  const currentTurnElapsed = useMemo(() => {
    if (!turnStartTime) {
      return 0
    }
    return Math.max(0, currentTime - turnStartTime)
  }, [currentTime, turnStartTime])

  /**
   * Provides a quick count of logged turns for the status panel.
   */
  const turnsRecorded = turnHistory.length

  /**
   * Indicates when the tracker has enough history to show post-combat stats.
   */
  const hasStatsToShow = Boolean(lastCombatStats && lastCombatStats.totalTurns > 0)

  /**
   * Decides whether the stats panel should appear instead of the tracker body.
   */
  const shouldShowStats = isStatsVisible && hasStatsToShow

  /**
   * Reports whether combat is currently in progress.
   */
  const isCombatActive = activeCombatantId !== null

  /**
   * Updates the add-combatant form state for a specific field.
   */
  const handleFormChange = useCallback((field: keyof FormDataState, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  /**
   * Resets the add-combatant form to its initial empty values.
   */
  const resetForm = useCallback(() => {
    setFormData({ name: '', maxHp: '', initiative: '', type: 'player' })
  }, [])

  /**
   * Adds a new combatant to the initiative order after validating input.
   */
  const handleAddCombatant = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const name = formData.name.trim()
      const maxHp = Number.parseInt(formData.maxHp, 10)
      const initiative = Number.parseInt(formData.initiative, 10)

      if (!name) {
        setFormError('Give every combatant a name so you recognize them in the fray.')
        return
      }

      if (!Number.isFinite(maxHp) || maxHp <= 0) {
        setFormError('Max HP must be a positive number to track health correctly.')
        return
      }

      if (!Number.isFinite(initiative)) {
        setFormError('Set an initiative value so the tracker can place this combatant.')
        return
      }

      dispatch(
        addCombatantAction({
          name,
          maxHp: Math.trunc(maxHp),
          initiative: Math.trunc(initiative),
          type: formData.type,
        }),
      )

      setFormError('')
      resetForm()
    },
    [dispatch, formData, resetForm],
  )

  /**
   * Removes a combatant from the initiative order.
   */
  const handleRemoveCombatant = useCallback(
    (id: string) => {
      dispatch(removeCombatantAction(id))
    },
    [dispatch],
  )

  /**
   * Restores a combatant to full hit points.
   */
  const handleResetCombatant = useCallback(
    (id: string) => {
      dispatch(resetCombatantAction(id))
    },
    [dispatch],
  )

  /**
   * Updates the adjustment draft value for a specific combatant.
   */
  const handleAdjustmentChange = useCallback((id: string, value: string) => {
    setAdjustments((prev) => {
      const previous = prev[id] ?? createDefaultAdjustmentDraft()

      return {
        ...prev,
        [id]: {
          ...previous,
          value,
        },
      }
    })
  }, [])

  const toggleDamageModifier = useCallback((id: string, modifier: DamageModifier) => {
    setAdjustments((prev) => {
      const previous = prev[id] ?? createDefaultAdjustmentDraft()
      const nextModifier = previous.damageModifier === modifier ? 'normal' : modifier

      return {
        ...prev,
        [id]: {
          ...previous,
          damageModifier: nextModifier,
        },
      }
    })
  }, [])

  /**
   * Applies damage or healing to a combatant based on user input.
   */
  const applyAdjustment = useCallback(
    (id: string, direction: 'damage' | 'heal') => {
      const draft = adjustments[id]
      const rawValue = draft?.value ?? ''
      const segments = rawValue
        .split(/[,+\s]+/)
        .map((segment) => Number.parseInt(segment, 10))
        .filter((value) => Number.isFinite(value) && value > 0)

      const amount = segments.reduce((total, value) => total + value, 0)

      if (!Number.isFinite(amount) || amount <= 0) {
        setAdjustments((prev) => ({
          ...prev,
          [id]: {
            value: '',
            damageModifier: draft?.damageModifier ?? 'normal',
          },
        }))
        return
      }

      if (direction === 'damage') {
        let adjustedAmount = amount
        const modifier = draft?.damageModifier ?? 'normal'

        if (modifier === 'resistant') {
          adjustedAmount = Math.floor(amount / 2)
        } else if (modifier === 'vulnerable') {
          adjustedAmount = amount * 2
        }

        dispatch(applyDamageAction({ id, amount: adjustedAmount }))
      } else {
        dispatch(applyHealingAction({ id, amount }))
      }

      setAdjustments((prev) => ({
        ...prev,
        [id]: {
          value: '',
          damageModifier: draft?.damageModifier ?? 'normal',
        },
      }))
    },
    [adjustments, dispatch],
  )

  /**
   * Updates the initiative draft for a combatant when the user edits the input.
   */
  const handleInitiativeDraftChange = useCallback((id: string, value: string) => {
    setInitiativeDrafts((prev) => ({
      ...prev,
      [id]: { value, isDirty: true },
    }))
  }, [])

  /**
   * Resets an initiative draft back to the stored initiative value.
   */
  const revertInitiativeDraft = useCallback(
    (id: string) => {
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
    },
    [combatants],
  )

  /**
   * Commits a pending initiative draft to Redux after validation.
   */
  const commitInitiativeChange = useCallback(
    (id: string) => {
      const combatant = combatants.find((entry) => entry.id === id)

      if (!combatant) return

      const draftEntry = initiativeDrafts[id]
      const rawValue = draftEntry ? draftEntry.value.trim() : ''
      const parsedInitiative = Number.parseInt(rawValue, 10)

      if (!Number.isFinite(parsedInitiative)) {
        revertInitiativeDraft(id)
        return
      }

      dispatch(
        updateInitiativeAction({
          id,
          initiative: Math.trunc(parsedInitiative),
        }),
      )

      setInitiativeDrafts((prev) => ({
        ...prev,
        [id]: { value: String(Math.trunc(parsedInitiative)), isDirty: false },
      }))
    },
    [combatants, dispatch, initiativeDrafts, revertInitiativeDraft],
  )

  /**
   * Handles keyboard shortcuts in initiative inputs for quick saving or reverting.
   */
  const handleInitiativeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, id: string) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commitInitiativeChange(id)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        revertInitiativeDraft(id)
      }
    },
    [commitInitiativeChange, revertInitiativeDraft],
  )

  /**
   * Clears all monsters from the initiative order.
   */
  const handleClearMonsters = useCallback(() => {
    dispatch(clearMonstersAction())
  }, [dispatch])

  /**
   * Generates and stores a whimsical nickname for a monster combatant.
   */
  const handleGenerateMonsterNickname = useCallback(
    (combatantId: string) => {
      const combatant = combatants.find((entry) => entry.id === combatantId)

      if (!combatant || combatant.type !== 'monster') {
        return
      }

      const nickname = generateFantasyName()
      dispatch(
        setCombatantTagAction({
          id: combatantId,
          title: 'Nickname',
          value: nickname,
        }),
      )
    },
    [combatants, dispatch],
  )

  /**
   * Records the duration of the active turn and appends it to the history log.
   */
  const recordTurnDuration = useCallback(
    (endTimestamp: number = Date.now()) => {
      if (activeCombatantId === null || turnStartTime === null) {
        return turnHistory
      }

      const combatant = combatants.find((entry) => entry.id === activeCombatantId)
      const entry: TurnHistoryEntry = {
        combatantId: activeCombatantId,
        combatantName: combatant ? combatant.name : 'Unknown combatant',
        startedAt: turnStartTime,
        endedAt: endTimestamp,
        duration: Math.max(0, endTimestamp - turnStartTime),
      }

      let nextHistory: TurnHistoryEntry[] | null = null

      setTurnHistory((prev) => {
        const updatedHistory = [...prev, entry]
        nextHistory = updatedHistory
        return updatedHistory
      })

      return nextHistory ?? [...turnHistory, entry]
    },
    [activeCombatantId, combatants, turnHistory, turnStartTime],
  )

  /**
   * Starts combat by selecting the first combatant and resetting timers.
   */
  const handleStartCombat = useCallback(() => {
    if (sortedCombatants.length === 0) {
      return
    }

    const firstCombatantId = sortedCombatants[0].id
    const now = Date.now()

    setTurnHistory([])
    setTurnStartTime(now)
    setIsStatsVisible(false)
    setActiveCombatantId(firstCombatantId)
  }, [sortedCombatants])

  /**
   * Advances the initiative order to the next combatant.
   */
  const handleAdvanceTurn = useCallback(() => {
    if (sortedCombatants.length === 0) {
      return
    }

    if (!isCombatActive) {
      handleStartCombat()
      return
    }

    const currentIndex = sortedCombatants.findIndex((combatant) => combatant.id === activeCombatantId)
    const nextIndex =
      currentIndex === -1 || currentIndex === sortedCombatants.length - 1 ? 0 : currentIndex + 1

    recordTurnDuration()

    setTurnStartTime(Date.now())
    setActiveCombatantId(sortedCombatants[nextIndex].id)
  }, [activeCombatantId, handleStartCombat, isCombatActive, recordTurnDuration, sortedCombatants])

  /**
   * Ends combat, captures statistics, and resets timers.
   */
  const handleEndCombat = useCallback(() => {
    if (!isCombatActive) {
      return
    }

    const finalHistory = recordTurnDuration()
    const stats = computeCombatStats(finalHistory)

    setLastCombatStats(stats)
    setIsStatsVisible(true)
    setActiveCombatantId(null)
    setTurnStartTime(null)
  }, [isCombatActive, recordTurnDuration])

  /**
   * Handles adding a combatant based on a saved campaign roster entry.
   */
  const handleQuickAddFromTemplate = useCallback(
    (templateId: string) => {
      if (!activeCampaign) {
        setTemplateErrors((prev) => ({
          ...prev,
          [templateId]: 'Select a campaign before adding heroes to initiative.',
        }))
        return
      }

      const template = activeCampaignRoster.find((entry) => entry.id === templateId)

      if (!template) {
        setTemplateErrors((prev) => {
          const next = { ...prev }
          delete next[templateId]
          return next
        })
        return
      }

      const draftValue = templateInitiatives[templateId]
      const rawInitiative = typeof draftValue === 'string' ? draftValue.trim() : ''
      const initiative = Number.parseInt(rawInitiative, 10)

      if (!Number.isFinite(initiative)) {
        setTemplateErrors((prev) => ({
          ...prev,
          [templateId]: 'Set an initiative before adding to the tracker.',
        }))
        return
      }

      dispatch(
        addCombatantAction({
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
        delete next[templateId]
        return next
      })

      setTemplateInitiatives((prev) => ({
        ...prev,
        [templateId]: '',
      }))
    },
    [activeCampaign, activeCampaignRoster, dispatch, templateInitiatives],
  )

  /**
   * Captures initiative input for roster quick-add entries.
   */
  const handleTemplateInitiativeChange = useCallback((id: string, value: string) => {
    setTemplateInitiatives((prev) => ({
      ...prev,
      [id]: value,
    }))
  }, [])

  /**
   * Adds a monster from the campaign library or favorites directly into initiative.
   */
  const handleQuickAddMonster = useCallback(
    (monsterId: string, sourceCampaignId: string | null) => {
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

      const hitPoints = monster.hitPoints
      const maxHp =
        typeof hitPoints === 'number' && Number.isFinite(hitPoints) && hitPoints > 0
          ? hitPoints
          : 1

      dispatch(
        addCombatantAction({
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
    },
    [activeCampaign, dispatch, monsterInitiatives, monsterLibrary],
  )

  /**
   * Tracks initiative values typed in for monsters.
   */
  const handleMonsterInitiativeChange = useCallback((monsterId: string, value: string) => {
    setMonsterInitiatives((prev) => ({
      ...prev,
      [monsterId]: value,
    }))
  }, [])

  /**
   * Toggles a monster's favorite status from the initiative view.
   */
  const handleToggleMonsterFavoriteClick = useCallback(
    (monsterId: string) => {
      dispatch(toggleMonsterFavoriteAction(monsterId))
    },
    [dispatch],
  )

  /**
   * Switches the active campaign using the select menu.
   */
  const handleSelectCampaign = useCallback(
    (campaignId: string) => {
      if (!campaignId) {
        return
      }
      dispatch(setActiveCampaignAction(campaignId))
      setTemplateErrors({})
    },
    [dispatch],
  )

  /**
   * Removes a player template directly from the initiative roster section.
   */
  const handleRemovePlayerTemplate = useCallback(
    (characterId: string) => {
      if (!activeCampaignId) {
        return
      }
      dispatch(
        removePlayerCharacterAction({
          campaignId: activeCampaignId,
          characterId,
        }),
      )
    },
    [activeCampaignId, dispatch],
  )

  /**
   * Responds to the reset key from the parent by clearing local state.
   */
  useEffect(() => {
    setFormData({ name: '', maxHp: '', initiative: '', type: 'player' })
    setFormError('')
    setAdjustments({})
    setInitiativeDrafts({})
    setActiveCombatantId(null)
    setTurnHistory([])
    setTurnStartTime(null)
    setCurrentTime(Date.now())
    setIsStatsVisible(false)
    setLastCombatStats(null)
    setTemplateInitiatives({})
    setTemplateErrors({})
    setMonsterInitiatives({})
    setMonsterErrors({})
  }, [resetKey])

  /**
   * Keeps adjustment drafts in sync when combatants are added or removed.
   */
  useEffect(() => {
    setAdjustments((prev) => {
      const validIds = new Set(combatants.map((combatant) => combatant.id))
      const shouldUpdate = Object.keys(prev).some((id) => !validIds.has(id))

      if (!shouldUpdate) {
        return prev
      }

      const next: Record<string, AdjustmentDraft> = {}
      validIds.forEach((id) => {
        const draft = prev[id]
        if (draft) {
          next[id] = draft
        }
      })

      return next
    })
  }, [combatants])

  /**
   * Syncs initiative drafts with the authoritative values from Redux.
   */
  useEffect(() => {
    setInitiativeDrafts((prev) => {
      const next: Record<string, ValueDraft> = {}

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

  /**
   * Keeps template quick-add fields up to date as the roster changes.
   */
  useEffect(() => {
    setTemplateInitiatives((prev) => {
      const next: Record<string, string> = {}

      activeCampaignRoster.forEach((template) => {
        next[template.id] = typeof prev[template.id] === 'string' ? prev[template.id] : ''
      })

      return next
    })

    setTemplateErrors((prev) => {
      const next: Record<string, string> = {}

      activeCampaignRoster.forEach((template) => {
        if (prev[template.id]) {
          next[template.id] = prev[template.id]
        }
      })

      return next
    })
  }, [activeCampaignRoster])

  /**
   * Keeps monster quick-add fields synchronized with whichever lists are visible.
   */
  useEffect(() => {
    setMonsterInitiatives((prev) => {
      const next: Record<string, string> = {}

      visibleMonsterIds.forEach((id) => {
        next[id] = typeof prev[id] === 'string' ? prev[id] : ''
      })

      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(next)

      if (prevKeys.length === nextKeys.length && prevKeys.every((key) => next[key] === prev[key])) {
        return prev
      }

      return next
    })

    setMonsterErrors((prev) => {
      const next: Record<string, string> = {}

      visibleMonsterIds.forEach((id) => {
        if (prev[id]) {
          next[id] = prev[id]
        }
      })

      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(next)

      if (prevKeys.length === nextKeys.length && prevKeys.every((key) => next[key] === prev[key])) {
        return prev
      }

      return next
    })
  }, [visibleMonsterIds])

  /**
   * Keeps campaign details form tidy when the active campaign changes.
   */
  useEffect(() => {
    setTemplateErrors({})
    setTemplateInitiatives({})
  }, [activeCampaignId])

  /**
   * Updates the live timer while combat is running.
   */
  useEffect(() => {
    if (!isCombatActive || turnStartTime === null) {
      return undefined
    }

    setCurrentTime(Date.now())

    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isCombatActive, turnStartTime])

  /**
   * Ensures the active combatant remains valid when the roster changes.
   */
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

    const isActivePresent = sortedCombatants.some((combatant) => combatant.id === activeCombatantId)

    if (!isActivePresent) {
      setActiveCombatantId(sortedCombatants[0].id)
      setTurnStartTime(Date.now())
    }
  }, [sortedCombatants, activeCombatantId, turnStartTime])

  return (
    <>
      <section className="main__header">
        <div>
          <h2>Initiative Tracker</h2>
          <p>Command the flow of battle by managing heroes and monsters in one place.</p>
        </div>
        <div className="header-actions">
          <div className="initiative-summary">
            <span className="summary__label">Creatures</span>
            <span className="summary__value">{combatants.length}</span>
          </div>
          {hasStatsToShow && !shouldShowStats && (
            <button type="button" className="ghost-button" onClick={() => setIsStatsVisible(true)}>
              View last combat stats
            </button>
          )}
        </div>
      </section>

      {shouldShowStats ? (
        <section className="combat-stats">
          <header className="combat-stats__header">
            <div>
              <h3>Combat statistics</h3>
              <p>Review timing insights from the last initiative.</p>
            </div>
            <button type="button" className="ghost-button" onClick={() => setIsStatsVisible(false)}>
              Back to tracker
            </button>
          </header>
          {lastCombatStats && lastCombatStats.totalTurns === 0 ? (
            <div className="combat-stats__empty">
              <p>No turn timing data was captured for the last combat.</p>
            </div>
          ) : lastCombatStats ? (
            <>
              <div className="combat-stats__summary">
                <div className="combat-stats__summary-card">
                  <span className="combat-stats__summary-label">Total combat time</span>
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
                    <span className="combat-stats__summary-label">Longest turn</span>
                    <span className="combat-stats__summary-value">
                      {formatDurationVerbose(lastCombatStats.longestTurnEntry.duration)}
                    </span>
                    <span className="combat-stats__summary-hint">
                      {lastCombatStats.longestTurnEntry.combatantName}
                    </span>
                  </div>
                )}
                {lastCombatStats.fastestTurnEntry && (
                  <div className="combat-stats__summary-card">
                    <span className="combat-stats__summary-label">Quickest turn</span>
                    <span className="combat-stats__summary-value">
                      {formatDurationVerbose(lastCombatStats.fastestTurnEntry.duration)}
                    </span>
                    <span className="combat-stats__summary-hint">
                      {lastCombatStats.fastestTurnEntry.combatantName}
                    </span>
                  </div>
                )}
                {lastCombatStats.slowestAverage && (
                  <div className="combat-stats__summary-card">
                    <span className="combat-stats__summary-label">Slowest average</span>
                    <span className="combat-stats__summary-value">
                      {formatDurationVerbose(lastCombatStats.slowestAverage.averageDuration)}
                    </span>
                    <span className="combat-stats__summary-hint">
                      {lastCombatStats.slowestAverage.name}
                    </span>
                  </div>
                )}
                {lastCombatStats.quickestAverage && (
                  <div className="combat-stats__summary-card">
                    <span className="combat-stats__summary-label">Quickest average</span>
                    <span className="combat-stats__summary-value">
                      {formatDurationVerbose(lastCombatStats.quickestAverage.averageDuration)}
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
          ) : null}
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
                    onChange={(event) => handleFormChange('type', event.target.value as 'player' | 'monster')}
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
                    onChange={(event) => handleFormChange('initiative', event.target.value)}
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
                    className="ghost-button"
                    onClick={handleClearMonsters}
                  >
                    Clear monsters
                  </button>
                </div>
              </div>
              {sortedCombatants.length === 0 ? (
                <div className="tracker__empty">
                  <p>Add combatants to begin managing the initiative order.</p>
                </div>
              ) : (
                <CombatantList
                  combatants={sortedCombatants}
                  activeCombatantId={activeCombatantId}
                  initiativeDrafts={initiativeDrafts}
                  adjustments={adjustments}
                  monstersById={monsterLibrary.monsters}
                  onInitiativeDraftChange={handleInitiativeDraftChange}
                  onInitiativeCommit={commitInitiativeChange}
                  onInitiativeKeyDown={handleInitiativeKeyDown}
                  onRemoveCombatant={handleRemoveCombatant}
                  onGenerateMonsterNickname={handleGenerateMonsterNickname}
                  onAdjustmentChange={handleAdjustmentChange}
                  onToggleDamageModifier={toggleDamageModifier}
                  onApplyAdjustment={applyAdjustment}
                  onResetCombatant={handleResetCombatant}
                />
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
                    onChange={(event) => handleSelectCampaign(event.target.value)}
                  >
                    <option value="" disabled>
                      {sortedCampaigns.length === 0 ? 'No campaigns available' : 'Select campaign'}
                    </option>
                    {sortedCampaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="ghost-button" onClick={onNavigateToCampaigns}>
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
              <button type="button" className="ghost-button" onClick={onNavigateToCampaigns}>
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
                  const displayTags = getMonsterDisplayTags(monster)

                  return (
                    <li key={monster.id} className="template-card monster-card">
                      <header className="template-card__header monster-card__header">
                        <div>
                          <h5>{monster.name}</h5>
                          <div className="template-card__stats monster-card__stats">
                            {displayTags.map((tag) => (
                              <span key={tag} className="stat-chip">
                                {tag}
                              </span>
                            ))}
                          </div>
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
                            onChange={(event) => handleMonsterInitiativeChange(monster.id, event.target.value)}
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
                      {monster.sourceUrl && (
                        <a
                          href={monster.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="monster-card__link monster-card__link--standalone"
                        >
                          View on D&D Beyond
                        </a>
                      )}
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
                  const displayTags = getMonsterDisplayTags(monster)

                  return (
                    <li key={monster.id} className="template-card monster-card monster-card--compact">
                      <header className="template-card__header monster-card__header">
                        <div>
                          <h5>{monster.name}</h5>
                          <div className="template-card__stats monster-card__stats">
                            {displayTags.map((tag) => (
                              <span key={tag} className="stat-chip">
                                {tag}
                              </span>
                            ))}
                          </div>
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
                            onChange={(event) => handleMonsterInitiativeChange(monster.id, event.target.value)}
                            placeholder="0"
                            inputMode="numeric"
                          />
                        </label>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            handleQuickAddMonster(monster.id, activeCampaign ? activeCampaign.id : null)
                          }
                        >
                          Add monster
                        </button>
                      </div>
                      {monster.sourceUrl && (
                        <a
                          href={monster.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="monster-card__link monster-card__link--standalone"
                        >
                          View on D&D Beyond
                        </a>
                      )}
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
      )}
    </>
  )
}

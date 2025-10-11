import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import './App.css'
import {
  addCombatant,
  addPlayerTemplate as addPlayerTemplateAction,
  applyDamage,
  applyHealing,
  clearMonsters,
  loadState,
  removeCombatant as removeCombatantAction,
  removePlayerTemplate as removePlayerTemplateAction,
  resetCombatant as resetCombatantAction,
  updateInitiative as updateInitiativeAction,
} from './store/combatSlice'

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

function App() {
  const dispatch = useDispatch()
  const store = useStore()
  const combatants = useSelector((state) => state.combat.combatants)
  const playerTemplates = useSelector((state) => state.combat.playerTemplates)
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
  const [playerTemplateForm, setPlayerTemplateForm] = useState({
    name: '',
    maxHp: '',
    armorClass: '',
    notes: '',
  })
  const [playerTemplateError, setPlayerTemplateError] = useState('')
  const [templateInitiatives, setTemplateInitiatives] = useState({})
  const [templateErrors, setTemplateErrors] = useState({})
  const [activeCombatantId, setActiveCombatantId] = useState(null)
  const [turnHistory, setTurnHistory] = useState([])
  const [turnStartTime, setTurnStartTime] = useState(null)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [isStatsVisible, setIsStatsVisible] = useState(false)
  const [lastCombatStats, setLastCombatStats] = useState(null)
  const fileInputRef = useRef(null)
  const isCombatActive = activeCombatantId !== null

  const sortedCombatants = useMemo(() => {
    return [...combatants].sort((a, b) => {
      if (b.initiative === a.initiative) {
        return a.createdAt - b.createdAt
      }
      return b.initiative - a.initiative
    })
  }, [combatants])

  const sortedPlayerTemplates = useMemo(() => {
    return [...playerTemplates].sort((a, b) => a.createdAt - b.createdAt)
  }, [playerTemplates])

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
      addPlayerTemplateAction({
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
    dispatch(removePlayerTemplateAction(id))
  }

  const handleTemplateInitiativeChange = (id, value) => {
    setTemplateInitiatives((prev) => ({
      ...prev,
      [id]: value,
    }))
  }

  const handleQuickAddFromTemplate = (id) => {
    const template = playerTemplates.find((entry) => entry.id === id)

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

      playerTemplates.forEach((template) => {
        next[template.id] =
          typeof prev[template.id] === 'string' ? prev[template.id] : ''
      })

      return next
    })

    setTemplateErrors((prev) => {
      const next = {}

      playerTemplates.forEach((template) => {
        if (prev[template.id]) {
          next[template.id] = prev[template.id]
        }
      })

      return next
    })
  }, [playerTemplates])

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
  }, [sortedCombatants, activeCombatantId])

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

        if (parsed && typeof parsed === 'object' && parsed.combat) {
          dispatch(loadState(parsed.combat))
          setActiveCombatantId(null)
          setTurnStartTime(null)
          setTurnHistory([])
          setIsStatsVisible(false)
          setLoadError('')
        } else {
          setLoadError('The selected file does not contain combat data.')
        }
      } catch (error) {
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
          <h1>OneDND campaign assistant</h1>
          <p>Your party control room</p>
        </header>
        <nav className="sidebar__nav">
          <span className="sidebar__section">Campaign Tools</span>
          <ul>
            <li className="sidebar__item sidebar__item--active">Initiative Tracker</li>
            <li className="sidebar__item">Quest Log (coming soon)</li>
            <li className="sidebar__item">Treasure Ledger (coming soon)</li>
          </ul>
        </nav>
        <footer className="sidebar__footer">
          <p>Forged for D&D tables that crave order in the chaos.</p>
        </footer>
      </aside>

      <main className="main">
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
            {hasStatsToShow && !shouldShowStats && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsStatsVisible(true)}
              >
                View last combat stats
              </button>
            )}
          </div>
        </section>

        <section className="campaign-section">
          <header className="campaign-section__header">
            <div>
              <h3>Campaign roster</h3>
              <p>
                Save the full details of your primary characters once and pull them into combat
                whenever you need them.
              </p>
            </div>
          </header>
          <div className="campaign-section__content">
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
                <p>Set an initiative and pull them straight into the tracker.</p>
              </div>
              {sortedPlayerTemplates.length === 0 ? (
                <div className="campaign-roster__empty">
                  <p>
                    No heroes saved yet. Chronicle your party above to reuse them across
                    encounters.
                  </p>
                </div>
              ) : (
                <ul className="template-list">
                  {sortedPlayerTemplates.map((template) => {
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
                                handleTemplateInitiativeChange(
                                  template.id,
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
              )}
            </div>
          </div>
        </section>

        {shouldShowStats ? (
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
        )}
      </main>
    </div>
  )
}

export default App

import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import './App.css'
import {
  addCombatant,
  applyDamage,
  applyHealing,
  clearMonsters,
  removeCombatant as removeCombatantAction,
  resetCombatant as resetCombatantAction,
  updateInitiative as updateInitiativeAction,
} from './store/combatSlice'

function App() {
  const dispatch = useDispatch()
  const combatants = useSelector((state) => state.combat.combatants)
  const [formData, setFormData] = useState({
    name: '',
    maxHp: '',
    initiative: '',
    type: 'player',
  })
  const [formError, setFormError] = useState('')
  const [adjustments, setAdjustments] = useState({})
  const [initiativeDrafts, setInitiativeDrafts] = useState({})

  const sortedCombatants = useMemo(() => {
    return [...combatants].sort((a, b) => {
      if (b.initiative === a.initiative) {
        return a.createdAt - b.createdAt
      }
      return b.initiative - a.initiative
    })
  }, [combatants])

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const resetForm = () => {
    setFormData({ name: '', maxHp: '', initiative: '', type: 'player' })
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

  const handleAdjustmentChange = (id, value) => {
    setAdjustments((prev) => ({
      ...prev,
      [id]: value,
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

  const hasMonsters = combatants.some((combatant) => combatant.type === 'monster')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="sidebar__header">
          <h1>Dragonspire</h1>
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
          <div className="initiative-summary">
            <span className="summary__label">Creatures</span>
            <span className="summary__value">{combatants.length}</span>
          </div>
        </section>

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
              <h3>Initiative order</h3>
              <button
                type="button"
                className="danger-button"
                onClick={handleClearMonsters}
                disabled={!hasMonsters}
              >
                Clear monsters
              </button>
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
                  const isBloodied =
                    combatant.currentHp > 0 &&
                    combatant.currentHp <= combatant.maxHp / 2

                  return (
                    <li
                      key={combatant.id}
                      className={`combatant-card ${typeClassName}`}
                    >
                      <header className="combatant-card__header">
                        <div className="combatant-card__initiative">
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
      </main>
    </div>
  )
}

export default App

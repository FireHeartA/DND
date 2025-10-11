import { useMemo, useState } from 'react'
import './App.css'

function App() {
  const [combatants, setCombatants] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    maxHp: '',
    initiative: '',
  })
  const [formError, setFormError] = useState('')
  const [adjustments, setAdjustments] = useState({})

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
    setFormData({ name: '', maxHp: '', initiative: '' })
  }

  const handleAddCombatant = (event) => {
    event.preventDefault()
    const name = formData.name.trim()
    const maxHp = Number.parseInt(formData.maxHp, 10)
    const initiative = Number.parseInt(formData.initiative, 10)

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

    const id = crypto.randomUUID()

    setCombatants((prev) => [
      ...prev,
      {
        id,
        name,
        maxHp,
        currentHp: maxHp,
        initiative,
        createdAt: Date.now(),
      },
    ])

    setAdjustments((prev) => ({
      ...prev,
      [id]: '',
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

    setCombatants((prev) =>
      prev.map((combatant) => {
        if (combatant.id !== id) return combatant

        const delta = direction === 'damage' ? -amount : amount
        const nextHp = Math.min(
          combatant.maxHp,
          Math.max(0, combatant.currentHp + delta),
        )

        return {
          ...combatant,
          currentHp: nextHp,
        }
      }),
    )

    setAdjustments((prev) => ({
      ...prev,
      [id]: '',
    }))
  }

  const removeCombatant = (id) => {
    setCombatants((prev) => prev.filter((combatant) => combatant.id !== id))
    setAdjustments((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const resetCombatant = (id) => {
    setCombatants((prev) =>
      prev.map((combatant) =>
        combatant.id === id
          ? {
              ...combatant,
              currentHp: combatant.maxHp,
            }
          : combatant,
      ),
    )
  }

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
                  const isDown = combatant.currentHp === 0
                  const hpPercent = Math.round(
                    (combatant.currentHp / combatant.maxHp) * 100,
                  )

                  return (
                    <li key={combatant.id} className="combatant-card">
                      <header className="combatant-card__header">
                        <div className="combatant-card__initiative">
                          <span className="initiative-rank">#{index + 1}</span>
                          <span className="initiative-score">
                            Init {combatant.initiative}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => removeCombatant(combatant.id)}
                        >
                          Remove
                        </button>
                      </header>

                      <div className="combatant-card__body">
                        <div>
                          <h4 className="combatant-name">{combatant.name}</h4>
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
                            onClick={() => resetCombatant(combatant.id)}
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

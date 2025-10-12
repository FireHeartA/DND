import { useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import type { Combatant, MonsterDetails } from '../../types'
import type { AdjustmentDraft, DamageModifier, ValueDraft } from './types'

interface CombatantListProps {
  combatants: Combatant[]
  activeCombatantId: string | null
  initiativeDrafts: Record<string, ValueDraft>
  adjustments: Record<string, AdjustmentDraft>
  monstersById: Record<string, MonsterDetails>
  displayNames: Record<string, string>
  onInitiativeDraftChange: (id: string, value: string) => void
  onInitiativeCommit: (id: string) => void
  onInitiativeKeyDown: (event: KeyboardEvent<HTMLInputElement>, id: string) => void
  onRemoveCombatant: (id: string) => void
  onGenerateMonsterNickname: (id: string) => void
  onAdjustmentChange: (id: string, value: string) => void
  onToggleDamageModifier: (id: string, modifier: DamageModifier) => void
  onApplyAdjustment: (id: string, direction: 'damage' | 'heal') => void
  onResetCombatant: (id: string) => void
  onReorder: (sourceId: string, targetId: string, position: 'before' | 'after') => void
}

export const CombatantList: React.FC<CombatantListProps> = ({
  combatants,
  activeCombatantId,
  initiativeDrafts,
  adjustments,
  monstersById,
  displayNames,
  onInitiativeDraftChange,
  onInitiativeCommit,
  onInitiativeKeyDown,
  onRemoveCombatant,
  onGenerateMonsterNickname,
  onAdjustmentChange,
  onToggleDamageModifier,
  onApplyAdjustment,
  onResetCombatant,
  onReorder,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<{ id: string; position: 'before' | 'after' } | null>(null)

  const handleDragStart = (event: DragEvent<HTMLLIElement>, id: string) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
    setDraggedId(id)
  }

  const handleDragOver = (event: DragEvent<HTMLLIElement>, id: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    const boundingRect = event.currentTarget.getBoundingClientRect()
    const offset = event.clientY - boundingRect.top
    const position: 'before' | 'after' = offset < boundingRect.height / 2 ? 'before' : 'after'

    setDragOver((previous) => {
      if (previous && previous.id === id && previous.position === position) {
        return previous
      }
      return { id, position }
    })
  }

  const handleDragLeave = (event: DragEvent<HTMLLIElement>, id: string) => {
    event.preventDefault()

    setDragOver((previous) => {
      if (!previous || previous.id !== id) {
        return previous
      }
      return null
    })
  }

  const handleDrop = (event: DragEvent<HTMLLIElement>, id: string) => {
    event.preventDefault()

    const sourceId = draggedId ?? event.dataTransfer.getData('text/plain')
    if (!sourceId || sourceId === id) {
      setDraggedId(null)
      setDragOver(null)
      return
    }

    const position = dragOver?.id === id ? dragOver.position : 'before'
    onReorder(sourceId, id, position)

    setDraggedId(null)
    setDragOver(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOver(null)
  }

  return (
    <ul className="combatant-list">
      {combatants.map((combatant) => {
        const draft = initiativeDrafts[combatant.id]
        const adjustmentDraft = adjustments[combatant.id]
        const adjustment = adjustmentDraft?.value ?? ''
        const damageModifier = adjustmentDraft?.damageModifier ?? 'normal'
        const sourceMonster =
          combatant.type === 'monster' && combatant.sourceMonsterId
            ? monstersById[combatant.sourceMonsterId] ?? null
            : null
        const isBloodied = combatant.currentHp <= Math.max(1, combatant.maxHp / 2)
        const isDown = combatant.currentHp === 0
        const hpPercent = combatant.maxHp > 0 ? (combatant.currentHp / combatant.maxHp) * 100 : 0
        const nicknameTag = combatant.tags.find((tag) => tag.title.toLowerCase() === 'nickname')
        const displayName = displayNames[combatant.id] ?? combatant.name

        return (
          <li
            key={combatant.id}
            className={`combatant-card${
              combatant.id === activeCombatantId ? ' combatant-card--active' : ''
            }${draggedId === combatant.id ? ' combatant-card--dragging' : ''}${
              dragOver?.id === combatant.id ? ` combatant-card--drop-${dragOver.position}` : ''
            }`}
            draggable
            onDragStart={(event) => handleDragStart(event, combatant.id)}
            onDragOver={(event) => handleDragOver(event, combatant.id)}
            onDragLeave={(event) => handleDragLeave(event, combatant.id)}
            onDrop={(event) => handleDrop(event, combatant.id)}
            onDragEnd={handleDragEnd}
          >
            <header className="combatant-card__header">
              <div className="combatant-card__header-info">
                <label>
                  <span>Initiative</span>
                  <input
                    value={draft ? draft.value : ''}
                    onChange={(event) => onInitiativeDraftChange(combatant.id, event.target.value)}
                    onBlur={() => onInitiativeCommit(combatant.id)}
                    onKeyDown={(event) => onInitiativeKeyDown(event, combatant.id)}
                    placeholder="0"
                    inputMode="numeric"
                  />
                </label>
              </div>
              <button type="button" className="ghost-button" onClick={() => onRemoveCombatant(combatant.id)}>
                Remove
              </button>
            </header>

            <div className="combatant-card__body">
              <div className="combatant-card__details">
                <div className="combatant-card__title">
                  <h4 className="combatant-name">
                    {displayName}
                    {nicknameTag && <span className="combatant-nickname"> ({nicknameTag.value})</span>}
                  </h4>
                  <span className={`combatant-type-badge combatant-type-badge--${combatant.type}`}>
                    {combatant.type === 'player' ? 'Player' : 'Monster'}
                  </span>
                  {combatant.type === 'monster' && (
                    <button
                      type="button"
                      className="ghost-button ghost-button--compact generate-nickname-button"
                      onClick={() => onGenerateMonsterNickname(combatant.id)}
                    >
                      Generate nickname
                    </button>
                  )}
                  {isBloodied && (
                    <span className="bloodied-indicator" title="Bloodied" aria-label="Bloodied">
                      <span aria-hidden="true">🩸</span>
                    </span>
                  )}
                </div>
                <div className="hp-track">
                  <div className="hp-track__bar">
                    <span className="hp-track__fill" style={{ width: `${hpPercent}%` }} />
                  </div>
                  <span className={`hp-track__value ${isDown ? 'hp-track__value--down' : ''}`}>
                    {combatant.currentHp} / {combatant.maxHp} HP
                  </span>
                </div>
                <div className="combatant-card__meta">
                  {combatant.armorClass !== null && (
                    <span className="combatant-card__meta-item">AC {combatant.armorClass}</span>
                  )}
                  {combatant.sourceTemplateId && (
                    <span className="combatant-card__meta-item combatant-card__meta-item--tag">Roster</span>
                  )}
                  {combatant.sourceMonsterId && (
                    <span className="combatant-card__meta-item combatant-card__meta-item--tag">Monster</span>
                  )}
                  {combatant.tags.map((tag) => (
                    <span
                      key={`${combatant.id}-${tag.title}-${tag.value}`}
                      className="combatant-card__meta-item combatant-card__meta-item--tag"
                    >
                      {tag.title}: {tag.value}
                    </span>
                  ))}
                </div>
                {sourceMonster?.sourceUrl && (
                  <a
                    href={sourceMonster.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="combatant-card__link"
                  >
                    View on D&D Beyond
                  </a>
                )}
                {combatant.profileUrl && (
                  <a
                    href={combatant.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="combatant-card__link"
                  >
                    Open character profile
                  </a>
                )}
                {isDown && <p className="status status--down">Unconscious</p>}
              </div>

              <div className="combatant-card__actions">
                <label>
                  <span>Adjust HP</span>
                  <input
                    value={adjustment}
                    onChange={(event) => onAdjustmentChange(combatant.id, event.target.value)}
                    placeholder="5 8 12"
                    inputMode="text"
                  />
                </label>
                <div className="damage-modifier-controls">
                  <span className="damage-modifier-controls__label">Damage modifier</span>
                  <div className="damage-modifier-controls__buttons">
                    <button
                      type="button"
                      className={`ghost-button ghost-button--compact damage-modifier-button${
                        damageModifier === 'resistant' ? ' damage-modifier-button--active' : ''
                      }`}
                      onClick={() => onToggleDamageModifier(combatant.id, 'resistant')}
                      aria-pressed={damageModifier === 'resistant'}
                      title="Halve incoming damage (rounded down)"
                    >
                      Resistant
                    </button>
                    <button
                      type="button"
                      className={`ghost-button ghost-button--compact damage-modifier-button${
                        damageModifier === 'vulnerable' ? ' damage-modifier-button--active' : ''
                      }`}
                      onClick={() => onToggleDamageModifier(combatant.id, 'vulnerable')}
                      aria-pressed={damageModifier === 'vulnerable'}
                      title="Double incoming damage"
                    >
                      Vulnerable
                    </button>
                  </div>
                </div>
                <div className="action-buttons">
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => onApplyAdjustment(combatant.id, 'damage')}
                  >
                    Apply damage
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onApplyAdjustment(combatant.id, 'heal')}
                  >
                    Apply healing
                  </button>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onResetCombatant(combatant.id)}
                >
                  Reset HP
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

import { useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import type { Combatant, CombatantTag, MonsterDetails } from '../../types'
import { parseDefenseList } from '../../utils/monsterDefenses'
import { MonsterDefensePreview, type DefenseSelections } from './MonsterDefensePreview'
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
  onDeathSaveProgressChange: (
    id: string,
    payload: { successes?: number; failures?: number },
  ) => void
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
  onDeathSaveProgressChange,
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

  const handleDeathSaveClick = (
    combatantId: string,
    type: 'successes' | 'failures',
    index: number,
    currentCount: number,
  ) => {
    const newCount = currentCount === index + 1 ? index : index + 1
    onDeathSaveProgressChange(combatantId, { [type]: newCount })
  }

  const renderTagLabel = (tag: CombatantTag): string => {
    const title = tag.title.trim()
    const value = tag.value.trim()

    if (!title && !value) {
      return ''
    }

    if (!value) {
      return title
    }

    if (!title) {
      return value
    }

    return title.toLowerCase() === value.toLowerCase() ? title : `${title}: ${value}`
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
        const showDeathSaves = isDown && combatant.type === 'player'
        const hpPercent = combatant.maxHp > 0 ? (combatant.currentHp / combatant.maxHp) * 100 : 0
        const nicknameTag = combatant.tags.find((tag) => tag.title.toLowerCase() === 'nickname')
        const displayName = displayNames[combatant.id] ?? combatant.name
        const monsterTags =
          combatant.type === 'monster'
            ? combatant.tags.filter((tag) => tag.title.toLowerCase() !== 'nickname')
            : []
        const metaTags = combatant.type === 'monster' ? [] : combatant.tags
        const successCount = combatant.deathSaveSuccesses
        const failureCount = combatant.deathSaveFailures
        const defenseSelections: DefenseSelections | null =
          combatant.type === 'monster' && sourceMonster
            ? {
                damageImmunities: parseDefenseList(sourceMonster.damageImmunities),
                damageResistances: parseDefenseList(sourceMonster.damageResistances),
                damageVulnerabilities: parseDefenseList(sourceMonster.damageVulnerabilities),
              }
            : null
        const hasMetaItems =
          combatant.armorClass !== null ||
          Boolean(combatant.sourceTemplateId) ||
          Boolean(combatant.sourceMonsterId) ||
          metaTags.length > 0
        const hasLinks = Boolean(sourceMonster?.sourceUrl || combatant.profileUrl)
        const showFooter = hasMetaItems || hasLinks || isDown

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
                  <span className="combatant-card__initiative-label">
                    Initiative
                    {combatant.id === activeCombatantId ? (
                      <span className="initiative-star" role="img" aria-label="Active turn">
                        ★
                      </span>
                    ) : null}
                  </span>
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
                  {combatant.type === 'monster' && monsterTags.length > 0 && (
                    <div className="combatant-card__monster-tags">
                      {monsterTags.map((tag) => (
                        <span
                          key={`${combatant.id}-${tag.title}-${tag.value}`}
                          className="stat-chip combatant-card__monster-tag"
                        >
                          {renderTagLabel(tag)}
                        </span>
                      ))}
                    </div>
                  )}
                  {defenseSelections && <MonsterDefensePreview selections={defenseSelections} />}
                </div>
                <div className="hp-track">
                  <div className="hp-track__bar">
                    <span className="hp-track__fill" style={{ width: `${hpPercent}%` }} />
                  </div>
                  <span className={`hp-track__value ${isDown ? 'hp-track__value--down' : ''}`}>
                    {combatant.currentHp} / {combatant.maxHp} HP
                  </span>
                </div>
                {showFooter && (
                  <div className="combatant-card__footer">
                    {hasMetaItems && (
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
                        {metaTags.map((tag) => (
                          <span
                            key={`${combatant.id}-${tag.title}-${tag.value}`}
                            className="combatant-card__meta-item combatant-card__meta-item--tag"
                          >
                            {tag.title}: {tag.value}
                          </span>
                        ))}
                      </div>
                    )}
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
                    {showDeathSaves && (
                      <div className="death-save-tracker" aria-label="Death saving throws">
                        <div className="death-save-tracker__group" role="group" aria-label="Successes">
                          <span className="death-save-tracker__label">Successes</span>
                          <div className="death-save-tracker__boxes">
                            {[0, 1, 2].map((index) => {
                              const isFilled = index < successCount
                              return (
                                <button
                                  key={`${combatant.id}-success-${index}`}
                                  type="button"
                                  className={`death-save-box${isFilled ? ' death-save-box--success' : ''}`}
                                  aria-pressed={isFilled}
                                  aria-label={`Mark success ${index + 1}`}
                                  onClick={() =>
                                    handleDeathSaveClick(combatant.id, 'successes', index, successCount)
                                  }
                                >
                                  {isFilled ? '✔' : ''}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <div className="death-save-tracker__group" role="group" aria-label="Failures">
                          <span className="death-save-tracker__label">Failures</span>
                          <div className="death-save-tracker__boxes">
                            {[0, 1, 2].map((index) => {
                              const isFilled = index < failureCount
                              return (
                                <button
                                  key={`${combatant.id}-failure-${index}`}
                                  type="button"
                                  className={`death-save-box${isFilled ? ' death-save-box--failure' : ''}`}
                                  aria-pressed={isFilled}
                                  aria-label={`Mark failure ${index + 1}`}
                                  onClick={() =>
                                    handleDeathSaveClick(combatant.id, 'failures', index, failureCount)
                                  }
                                >
                                  {isFilled ? '✖' : ''}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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

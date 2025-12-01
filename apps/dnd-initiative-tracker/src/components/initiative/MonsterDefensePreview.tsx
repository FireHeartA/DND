import React from 'react'
import { getDefenseChipStyle } from '../../utils/monsterDefenses'

export type DefenseSelections = {
  damageImmunities: string[]
  damageResistances: string[]
  damageVulnerabilities: string[]
}

export const MonsterDefensePreview: React.FC<{ selections: DefenseSelections }> = ({ selections }) => {
  const hasDefenseSelections =
    selections.damageImmunities.length > 0 ||
    selections.damageResistances.length > 0 ||
    selections.damageVulnerabilities.length > 0

  if (!hasDefenseSelections) {
    return null
  }

  return (
    <div className="monster-card__defenses monster-card__defenses--preview">
      {([
        { field: 'damageImmunities' as const, label: 'Immunities' },
        { field: 'damageResistances' as const, label: 'Resistances' },
        { field: 'damageVulnerabilities' as const, label: 'Vulnerabilities' },
      ] as const).map(({ field, label }) => {
        const selectedValues = selections[field]
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
                const { backgroundColor, borderColor, color, option } = getDefenseChipStyle(value)
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
  )
}

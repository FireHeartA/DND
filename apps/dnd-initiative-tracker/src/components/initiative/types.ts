export interface ValueDraft {
  value: string
  isDirty: boolean
}

export type DamageModifier = 'normal' | 'resistant' | 'vulnerable' | 'immune'

export interface AdjustmentDraft {
  value: string
  damageModifier: DamageModifier
}

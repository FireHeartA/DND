import { buildMonsterTags } from './dndBeyondMonsterParser'
import type { CombatantTag, MonsterDetails } from '../types'

/**
 * Normalizes a monster tag by trimming whitespace and collapsing spaces.
 */
export const normalizeMonsterTag = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''

/**
 * Removes duplicate tag values and ensures consistent ordering.
 */
export const dedupeMonsterTags = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) {
    return []
  }

  const seen = new Set<string>()
  const result: string[] = []

  tags.forEach((tag) => {
    const normalized = normalizeMonsterTag(tag)
    if (!normalized) {
      return
    }
    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    result.push(normalized)
  })

  return result
}

/**
 * Groups tags into priority categories so vital stats appear first.
 */
export const prioritizeMonsterTags = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) {
    return []
  }

  const groups: Record<'hp' | 'ac' | 'cr' | 'pb' | 'other', string[]> = {
    hp: [],
    ac: [],
    cr: [],
    pb: [],
    other: [],
  }

  tags.forEach((tag) => {
    const normalized = String(tag).toUpperCase()
    if (normalized.startsWith('HP ')) {
      groups.hp.push(String(tag))
    } else if (normalized.startsWith('AC ')) {
      groups.ac.push(String(tag))
    } else if (normalized.startsWith('CR ')) {
      groups.cr.push(String(tag))
    } else if (normalized.startsWith('PB ')) {
      groups.pb.push(String(tag))
    } else {
      groups.other.push(String(tag))
    }
  })

  return [...groups.hp, ...groups.ac, ...groups.cr, ...groups.pb, ...groups.other]
}

/**
 * Creates an ordered list of tags ready for display in the UI.
 */
export const prepareMonsterTags = (tags: unknown): string[] =>
  prioritizeMonsterTags(dedupeMonsterTags(tags))

/**
 * Resolves the display tags for a monster, using generated tags as a fallback.
 */
export const getMonsterDisplayTags = (monster: MonsterDetails | null): string[] => {
  if (!monster || typeof monster !== 'object') {
    return []
  }

  const manualTags = Array.isArray(monster.tags) ? monster.tags : []
  const autoTags = buildMonsterTags(monster)

  return prepareMonsterTags([...manualTags, ...autoTags])
}

const TYPE_TAG_PATTERN = /^(Tiny|Small|Medium|Large|Huge|Gargantuan|Swarm of)/i

const parseMonsterTagForCombatant = (rawTag: unknown): CombatantTag | null => {
  if (typeof rawTag !== 'string') {
    return null
  }

  const normalized = rawTag.trim()
  if (!normalized) {
    return null
  }

  if (TYPE_TAG_PATTERN.test(normalized)) {
    return {
      title: 'Type',
      value: normalized,
    }
  }

  const colonIndex = normalized.indexOf(':')
  if (colonIndex > 0) {
    const title = normalized.slice(0, colonIndex).trim()
    const value = normalized.slice(colonIndex + 1).trim()
    if (title && value) {
      return { title, value }
    }
  }

  const spaceIndex = normalized.indexOf(' ')
  if (spaceIndex > 0) {
    const title = normalized.slice(0, spaceIndex).trim()
    const value = normalized.slice(spaceIndex + 1).trim()
    if (title && value) {
      return { title, value }
    }
  }

  return {
    title: normalized,
    value: normalized,
  }
}

export const getMonsterCombatantTags = (monster: MonsterDetails | null): CombatantTag[] => {
  if (!monster) {
    return []
  }

  const displayTags = getMonsterDisplayTags(monster)
  const parsed: CombatantTag[] = []

  displayTags.forEach((tag) => {
    const structured = parseMonsterTagForCombatant(tag)
    if (structured) {
      parsed.push(structured)
    }
  })

  return parsed
}

import type { MonsterDetails } from '../types'

/**
 * Removes markdown link syntax while keeping the link labels.
 */
const stripMarkdownLinks = (text: string): string => {
  if (typeof text !== 'string') {
    return ''
  }

  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, (match, label, offset) => {
    const previousChar = offset > 0 ? text[offset - 1] : ''
    const needsSpace = previousChar && !/\s/.test(previousChar)
    return `${needsSpace ? ' ' : ''}${label}`
  })
}

interface SectionDefinition {
  key:
    | 'traits'
    | 'actions'
    | 'bonusActions'
    | 'reactions'
    | 'legendaryActions'
    | 'mythicActions'
    | 'lairActions'
    | 'regionalEffects'
    | 'description'
  label: string
}

const SECTION_DEFINITIONS: SectionDefinition[] = [
  { key: 'traits', label: 'traits' },
  { key: 'actions', label: 'actions' },
  { key: 'bonusActions', label: 'bonus actions' },
  { key: 'reactions', label: 'reactions' },
  { key: 'legendaryActions', label: 'legendary actions' },
  { key: 'mythicActions', label: 'mythic actions' },
  { key: 'lairActions', label: 'lair actions' },
  { key: 'regionalEffects', label: 'regional effects' },
  { key: 'description', label: 'description' },
]

const SECTION_LABEL_SET = new Set(SECTION_DEFINITIONS.map((entry) => entry.label))

const TYPE_LINE_PATTERN = /^(?:tiny|small|medium|large|huge|gargantuan)\b.*$/i

/**
 * Removes lightweight markdown characters from a string.
 */
const stripFormatting = (text: string): string => {
  if (typeof text !== 'string') {
    return ''
  }
  const withoutLinks = stripMarkdownLinks(text)
  return withoutLinks.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Normalizes free-form tags so spacing is consistent.
 */
const normalizeTagValue = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''

interface TagCollector {
  add: (value: unknown) => void
  values: () => string[]
}

/**
 * Builds a set-like collector that stores unique tags in insertion order.
 */
const createTagCollector = (): TagCollector => {
  const entries: string[] = []
  const seen = new Set<string>()

  const add = (value: unknown) => {
    const normalized = normalizeTagValue(value)
    if (!normalized) {
      return
    }
    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    entries.push(normalized)
  }

  const values = () => entries.slice()

  return { add, values }
}

/**
 * Determines whether a line of markdown represents an image reference.
 */
const isImageLine = (line: string): boolean => {
  const trimmed = line.trim()
  return trimmed.startsWith('![') || trimmed.startsWith('[![')
}

/**
 * Removes markdown heading symbols and lowercases the text for comparisons.
 */
const normalizeHeading = (line: string): string => line.trim().replace(/^#+\s*/, '').toLowerCase()

const abilityLabelMap: Record<string, keyof MonsterDetails['abilityScores']> = {
  STR: 'str',
  DEX: 'dex',
  CON: 'con',
  INT: 'int',
  WIS: 'wis',
  CHA: 'cha',
}

const cleanStatLine = (line: string): string => stripFormatting(line).replace(/\s+/g, ' ').trim()

/**
 * Converts a slug string into a URL-safe format.
 */
const sanitizeSlug = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

interface SlugParseResult {
  slug: string
  referenceId: string | null
}

/**
 * Splits a slug segment into a normalized slug and optional reference ID.
 */
const parseSlugSegment = (segment: unknown): SlugParseResult => {
  const trimmed = typeof segment === 'string' ? segment.trim() : ''
  if (!trimmed) {
    return { slug: '', referenceId: null }
  }
  const lowered = trimmed.toLowerCase().replace(/\/.*/, '')
  const match = lowered.match(/^(\d+)-(.*)$/)
  if (match) {
    const [, idPart, slugPart] = match
    return { slug: sanitizeSlug(slugPart), referenceId: idPart }
  }
  return { slug: sanitizeSlug(lowered), referenceId: null }
}

/**
 * Parses a numeric string and returns null when invalid.
 */
const parseNumeric = (value: unknown): number | null => {
  const number = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(number) ? number : null
}

interface MonsterSections {
  traits: string[]
  actions: string[]
  bonusActions: string[]
  reactions: string[]
  legendaryActions: string[]
  mythicActions: string[]
  lairActions: string[]
  regionalEffects: string[]
  description: string[]
}

/**
 * Breaks markdown content into the descriptive sections used by the tracker.
 */
const buildSections = (lines: string[]): MonsterSections => {
  const headingEntries: Array<{ key: MonsterSectionsKey; index: number }> = []

  type MonsterSectionsKey = keyof MonsterSections

  lines.forEach((line, index) => {
    const normalized = normalizeHeading(line)
    const match = SECTION_DEFINITIONS.find((entry) => entry.label === normalized)
    if (match) {
      headingEntries.push({ key: match.key as MonsterSectionsKey, index })
    }
  })

  headingEntries.sort((a, b) => a.index - b.index)

  const sections = SECTION_DEFINITIONS.reduce<MonsterSections>(
    (acc, entry) => ({
      ...acc,
      [entry.key]: [],
    }),
    {
      traits: [],
      actions: [],
      bonusActions: [],
      reactions: [],
      legendaryActions: [],
      mythicActions: [],
      lairActions: [],
      regionalEffects: [],
      description: [],
    },
  )

  headingEntries.forEach((entry, idx) => {
    const next = headingEntries[idx + 1]
    const start = entry.index + 1
    const end = next ? next.index : lines.length
    const rawSection = lines.slice(start, end)

    const paragraphs: string[] = []
    let buffer: string[] = []

    rawSection.forEach((line) => {
      if (!line.trim()) {
        if (buffer.length > 0) {
          paragraphs.push(stripFormatting(buffer.join(' ')))
          buffer = []
        }
        return
      }

      if (isImageLine(line)) {
        return
      }

      const cleaned = stripFormatting(line)
      if (!cleaned) {
        return
      }

      buffer.push(cleaned)
    })

    if (buffer.length > 0) {
      paragraphs.push(stripFormatting(buffer.join(' ')))
    }

    sections[entry.key as MonsterSectionsKey] = paragraphs
  })

  return sections
}

/**
 * Builds a multi-line note field summarizing important monster statistics.
 */
export const buildMonsterNotes = (monster: MonsterDetails): string => {
  const parts: string[] = []

  if (monster.typeLine) {
    parts.push(monster.typeLine)
  }

  const defensive: string[] = []
  if (monster.armorClass !== null) {
    defensive.push(`AC ${monster.armorClass}${monster.armorNotes ? ` (${monster.armorNotes})` : ''}`)
  }
  if (monster.hitPoints !== null) {
    defensive.push(`HP ${monster.hitPoints}${monster.hitDice ? ` (${monster.hitDice})` : ''}`)
  }
  if (defensive.length > 0) {
    parts.push(defensive.join(' • '))
  }

  if (monster.speed) {
    parts.push(`Speed ${monster.speed}`)
  }

  if (monster.savingThrows) {
    parts.push(`Saving Throws: ${monster.savingThrows}`)
  }

  if (monster.skills) {
    parts.push(`Skills: ${monster.skills}`)
  }

  if (monster.damageVulnerabilities) {
    parts.push(`Vulnerabilities: ${monster.damageVulnerabilities}`)
  }

  if (monster.damageResistances) {
    parts.push(`Resistances: ${monster.damageResistances}`)
  }

  if (monster.damageImmunities) {
    parts.push(`Immunities: ${monster.damageImmunities}`)
  }

  if (monster.conditionImmunities) {
    parts.push(`Condition Immunities: ${monster.conditionImmunities}`)
  }

  if (monster.senses) {
    parts.push(`Senses: ${monster.senses}`)
  }

  if (monster.languages) {
    parts.push(`Languages: ${monster.languages}`)
  }

  if (monster.challengeRating) {
    const challengeLine = monster.challengeXp
      ? `Challenge ${monster.challengeRating} (${monster.challengeXp})`
      : `Challenge ${monster.challengeRating}`
    parts.push(challengeLine)
  }

  if (monster.proficiencyBonus) {
    parts.push(`Proficiency Bonus ${monster.proficiencyBonus}`)
  }

  const sectionStrings: Array<{ label: string; content: string[] }> = [
    { label: 'Traits', content: monster.traits },
    { label: 'Actions', content: monster.actions },
    { label: 'Bonus Actions', content: monster.bonusActions },
    { label: 'Reactions', content: monster.reactions },
    { label: 'Legendary Actions', content: monster.legendaryActions },
    { label: 'Mythic Actions', content: monster.mythicActions },
    { label: 'Lair Actions', content: monster.lairActions },
    { label: 'Regional Effects', content: monster.regionalEffects },
  ]

  sectionStrings.forEach(({ label, content }) => {
    if (Array.isArray(content) && content.length > 0) {
      parts.push(`${label}:\n${content.join('\n')}`)
    }
  })

  if (monster.description && monster.description.length > 0) {
    parts.push(`Description:\n${monster.description.join('\n')}`)
  }

  if (monster.source) {
    parts.push(`Source: ${monster.source}`)
  }

  if (monster.sourceUrl) {
    parts.push(`D&D Beyond: ${monster.sourceUrl}`)
  }

  return parts.join('\n')
}

/**
 * Constructs tag strings that highlight key monster statistics.
 */
export const buildMonsterTags = (monster: MonsterDetails): string[] => {
  if (!monster || typeof monster !== 'object') {
    return []
  }

  const collector = createTagCollector()

  if (monster.hitPoints !== null) {
    const hitPointsTag = monster.hitDice
      ? `HP ${monster.hitPoints} (${monster.hitDice})`
      : `HP ${monster.hitPoints}`
    collector.add(hitPointsTag)
  }

  if (monster.armorClass !== null) {
    const armorClassTag = monster.armorNotes
      ? `AC ${monster.armorClass} (${monster.armorNotes})`
      : `AC ${monster.armorClass}`
    collector.add(armorClassTag)
  }

  if (monster.challengeRating) {
    collector.add(`CR ${monster.challengeRating}`)
  }

  if (monster.proficiencyBonus) {
    collector.add(`PB ${monster.proficiencyBonus}`)
  }

  if (monster.typeLine) {
    collector.add(monster.typeLine)
  }

  if (monster.speed) {
    collector.add(`Speed ${monster.speed}`)
  }

  if (monster.savingThrows) {
    collector.add(`Saves ${monster.savingThrows}`)
  }

  if (monster.skills) {
    collector.add(`Skills ${monster.skills}`)
  }

  if (monster.damageVulnerabilities) {
    collector.add(`Vulnerable ${monster.damageVulnerabilities}`)
  }

  if (monster.damageResistances) {
    collector.add(`Resist ${monster.damageResistances}`)
  }

  if (monster.damageImmunities) {
    collector.add(`Immune ${monster.damageImmunities}`)
  }

  if (monster.conditionImmunities) {
    collector.add(`Condition Immune ${monster.conditionImmunities}`)
  }

  if (monster.senses) {
    collector.add(`Senses ${monster.senses}`)
  }

  if (monster.languages) {
    collector.add(`Languages ${monster.languages}`)
  }

  return collector.values()
}

export interface NormalizedDndBeyondUrl {
  normalizedUrl: string
  slug: string
  referenceId: string | null
}

/**
 * Validates that a URL points to a D&D Beyond monster and normalizes it for fetching.
 */
export const normalizeDndBeyondUrl = (rawUrl: string): NormalizedDndBeyondUrl => {
  if (typeof rawUrl !== 'string') {
    throw new Error('Enter a valid external URL')
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl, 'https://www.dndbeyond.com')
  } catch {
    throw new Error('Enter a valid external URL')
  }

  if (!parsed.hostname.endsWith('dndbeyond.com')) {
    throw new Error('Enter a valid external URL')
  }

  if (!parsed.pathname.includes('/monsters/')) {
    throw new Error('Enter a valid external URL')
  }

  parsed.protocol = 'https:'
  parsed.hash = ''
  parsed.search = ''

  const segments = parsed.pathname.split('/').filter(Boolean)
  const slugSegment = segments[segments.length - 1] || ''
  const { slug, referenceId } = parseSlugSegment(slugSegment)

  return {
    normalizedUrl: parsed.toString(),
    slug,
    referenceId,
  }
}

export interface ParsedMonsterData {
  name: string
  slug: string
  referenceId: string | null
  sourceUrl: string
  typeLine: string
  armorClass: number | null
  armorNotes: string
  hitPoints: number | null
  hitDice: string
  speed: string
  abilityScores: MonsterDetails['abilityScores']
  savingThrows: string
  skills: string
  damageVulnerabilities: string
  damageResistances: string
  damageImmunities: string
  conditionImmunities: string
  senses: string
  languages: string
  challengeRating: string
  challengeXp: string
  proficiencyBonus: string
  traits: string[]
  actions: string[]
  bonusActions: string[]
  reactions: string[]
  legendaryActions: string[]
  mythicActions: string[]
  lairActions: string[]
  regionalEffects: string[]
  description: string[]
  habitat: string
  source: string
  tags: string[]
  notes: string
}

/**
 * Parses markdown fetched from D&D Beyond into a structured monster object.
 */
export const parseDndBeyondMonster = (markdown: string, sourceUrl: string): ParsedMonsterData => {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    throw new Error('No monster content was returned from D&D Beyond.')
  }

  const { normalizedUrl, slug, referenceId } = normalizeDndBeyondUrl(sourceUrl)

  const rawLines = markdown
    .split('\n')
    .map((line) => line.replace(/\r/g, ''))
    .filter((line) => !line.trim().startsWith('Dismiss'))

  const commentsIndex = rawLines.findIndex((line) => normalizeHeading(line) === 'comments')
  const relevantLines = commentsIndex === -1 ? rawLines : rawLines.slice(0, commentsIndex)

  let name = ''
  let nameIndex = -1

  for (let index = 0; index < relevantLines.length; index += 1) {
    const trimmed = relevantLines[index].trim()
    if (!trimmed) {
      continue
    }

    if (!name) {
      const titleMatch = trimmed.match(/^title\s*:\s*(.+)$/i)
      if (titleMatch) {
        const candidate = stripFormatting(titleMatch[1])
        if (candidate) {
          name = candidate
          nameIndex = index
          break
        }
        continue
      }
    }

    const match = trimmed.match(/\[([^\]]+)\]\(https:\/\/www\.dndbeyond\.com\/monsters\//i)
    if (match) {
      const candidate = stripFormatting(match[1])
      if (candidate) {
        name = candidate
        nameIndex = index
        break
      }
    }
  }

  if (!name) {
    throw new Error('Failed to detect the monster name from the fetched content.')
  }

  const dataStart = nameIndex + 1
  const dataLines = relevantLines.slice(dataStart).map((line) => stripMarkdownLinks(line))
  const filteredDataLines = dataLines.filter((line) => !isImageLine(line))

  const sectionStartIndex = filteredDataLines.findIndex((line) =>
    SECTION_LABEL_SET.has(normalizeHeading(line)),
  )

  const statBlockLines =
    sectionStartIndex === -1
      ? filteredDataLines
      : filteredDataLines.slice(0, sectionStartIndex)

  const bodyLines =
    sectionStartIndex === -1 ? [] : filteredDataLines.slice(sectionStartIndex)

  const cleanedStatLines = statBlockLines.map((line) => cleanStatLine(line)).filter(Boolean)


  const candidateTypeLine =
    cleanedStatLines.find((line) => TYPE_LINE_PATTERN.test(line)) ||
    cleanedStatLines.find((line) => {
      const lowered = line.toLowerCase()
      return !lowered.startsWith('legacy ') && line !== name
    }) ||
    ''

  const typeLine = candidateTypeLine

  const buildLabelPattern = (label: string) => new RegExp(`^${label}(?:\\s|$)`, 'i')

  const findStatLine = (label: string): string => {
    const pattern = buildLabelPattern(label)
    const entry = cleanedStatLines.find((line) => pattern.test(line))
    if (!entry) {
      return ''
    }
    return entry.replace(pattern, '').replace(/^[\\s:]+/, '').trim()
  }

  const armorLine = findStatLine('Armor Class')
  const armorMatch = armorLine.match(/^(\d+)(?:\s*\(([^)]+)\))?/i)
  const armorClass = armorMatch ? parseNumeric(armorMatch[1]) : null
  const armorNotes = armorMatch && armorMatch[2] ? armorMatch[2].trim() : ''

  const hitPointsLine = findStatLine('Hit Points')
  const hitPointsMatch = hitPointsLine.match(/^(\d+)(?:\s*\(([^)]+)\))?/i)
  const hitPoints = hitPointsMatch ? parseNumeric(hitPointsMatch[1]) : null
  const hitDice = hitPointsMatch && hitPointsMatch[2] ? hitPointsMatch[2].trim() : ''

  const speed = findStatLine('Speed')

  const abilityScores: MonsterDetails['abilityScores'] = {
    str: null,
    dex: null,
    con: null,
    int: null,
    wis: null,
    cha: null,
  }

  cleanedStatLines.forEach((line, index) => {
    const trimmed = line.trim()
    const upper = trimmed.toUpperCase()
    const abilityKey = abilityLabelMap[upper]
    if (abilityKey) {
      const inlineMatch = trimmed.match(/^(STR|DEX|CON|INT|WIS|CHA)\s*(\d+)/i)
      if (inlineMatch && inlineMatch[2]) {
        const parsed = parseNumeric(inlineMatch[2])
        if (parsed !== null) {
          abilityScores[abilityKey] = parsed
        }
        return
      }
      const nextLine = cleanedStatLines[index + 1] || ''
      const valueMatch = nextLine.match(/(\d+)/)
      if (valueMatch) {
        const parsed = parseNumeric(valueMatch[1])
        if (parsed !== null) {
          abilityScores[abilityKey] = parsed
        }
      }
      return
    }

    const inlineMatch = trimmed.match(/^(STR|DEX|CON|INT|WIS|CHA)\s*(\d+)/i)
    if (inlineMatch) {
      const key = abilityLabelMap[inlineMatch[1].toUpperCase()]
      const parsed = parseNumeric(inlineMatch[2])
      if (key && parsed !== null) {
        abilityScores[key] = parsed
      }
    }
  })

  const savingThrows = findStatLine('Saving Throws')
  const skills = findStatLine('Skills')
  const damageVulnerabilities = findStatLine('Damage Vulnerabilities')
  const damageResistances = findStatLine('Damage Resistances')
  const damageImmunities = findStatLine('Damage Immunities')
  const conditionImmunities = findStatLine('Condition Immunities')
  const senses = findStatLine('Senses')
  const languages = findStatLine('Languages')
  const challengeLine = findStatLine('Challenge')

  let challengeRating = ''
  let challengeXp = ''
  if (challengeLine) {
    const match = challengeLine.match(/^(.*?)(?:\s*\(([^)]+)\))?$/)
    if (match) {
      challengeRating = match[1].trim()
      challengeXp = match[2] ? match[2].trim() : ''
    } else {
      challengeRating = challengeLine
    }
  }

  const proficiencyBonus = findStatLine('Proficiency Bonus')

  const sections = buildSections(bodyLines)

  const description = sections.description
  const habitatLineFromDescription = description.find((line) =>
    line.toLowerCase().startsWith('habitat:'),
  )
  const sourceLineFromDescription = description.find((line) =>
    line.toLowerCase().startsWith('source:'),
  )

  const normalizedDataLines = filteredDataLines.map((line) => cleanStatLine(line))
  const habitatLine =
    habitatLineFromDescription ||
    normalizedDataLines.find((line) => line.toLowerCase().startsWith('habitat:')) ||
    ''
  const sourceLine =
    sourceLineFromDescription ||
    normalizedDataLines.find((line) => line.toLowerCase().startsWith('source:')) ||
    ''

  const habitat = habitatLine ? habitatLine.replace(/^habitat:\s*/i, '') : ''
  let source = sourceLine ? sourceLine.replace(/^source:\s*/i, '') : ''

  if (!source) {
    const habitatIndex = normalizedDataLines.findIndex((line) => line === habitatLine)
    if (habitatIndex !== -1) {
      for (let index = habitatIndex + 1; index < normalizedDataLines.length; index += 1) {
        const candidate = normalizedDataLines[index]
        if (!candidate) {
          continue
        }
        const loweredCandidate = candidate.toLowerCase()
        if (loweredCandidate.startsWith('monster tags')) {
          continue
        }
        if (loweredCandidate.startsWith('habitat:')) {
          continue
        }
        source = loweredCandidate.startsWith('source:')
          ? candidate.replace(/^source:\s*/i, '')
          : candidate
        break
      }
    }
  }

  const tagsCollector = createTagCollector()
  tagsCollector.add(typeLine)
  tagsCollector.add(challengeRating ? `CR ${challengeRating}` : '')
  tagsCollector.add(armorClass !== null ? `AC ${armorClass}` : '')
  tagsCollector.add(hitPoints !== null ? `HP ${hitPoints}` : '')
  tagsCollector.add(speed ? `Speed ${speed}` : '')

  return {
    name,
    slug,
    referenceId,
    sourceUrl: normalizedUrl,
    typeLine,
    armorClass,
    armorNotes,
    hitPoints,
    hitDice,
    speed,
    abilityScores,
    savingThrows,
    skills,
    damageVulnerabilities,
    damageResistances,
    damageImmunities,
    conditionImmunities,
    senses,
    languages,
    challengeRating,
    challengeXp,
    proficiencyBonus,
    traits: sections.traits,
    actions: sections.actions,
    bonusActions: sections.bonusActions,
    reactions: sections.reactions,
    legendaryActions: sections.legendaryActions,
    mythicActions: sections.mythicActions,
    lairActions: sections.lairActions,
    regionalEffects: sections.regionalEffects,
    description: sections.description,
    habitat,
    source,
    tags: tagsCollector.values(),
    notes: '',
  }
}

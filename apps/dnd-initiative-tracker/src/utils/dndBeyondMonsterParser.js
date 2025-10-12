const stripMarkdownLinks = (text) => {
  if (typeof text !== 'string') {
    return ''
  }

  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, (match, label, offset) => {
    const previousChar = offset > 0 ? text[offset - 1] : ''
    const needsSpace = previousChar && !/\s/.test(previousChar)
    return `${needsSpace ? ' ' : ''}${label}`
  })
}

const SECTION_DEFINITIONS = [
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

const stripFormatting = (text) => {
  if (typeof text !== 'string') {
    return ''
  }
  const withoutLinks = stripMarkdownLinks(text)
  return withoutLinks.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim()
}

const isImageLine = (line) => {
  const trimmed = line.trim()
  return trimmed.startsWith('![') || trimmed.startsWith('[![')
}

const normalizeHeading = (line) => line.trim().replace(/^#+\s*/, '').toLowerCase()

const sanitizeSlug = (value) => {
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

const parseSlugSegment = (segment) => {
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

const parseNumeric = (value) => {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) ? number : null
}

const buildSections = (lines) => {
  const headingEntries = []

  lines.forEach((line, index) => {
    const normalized = normalizeHeading(line)
    const match = SECTION_DEFINITIONS.find((entry) => entry.label === normalized)
    if (match) {
      headingEntries.push({ key: match.key, index })
    }
  })

  headingEntries.sort((a, b) => a.index - b.index)

  const sections = SECTION_DEFINITIONS.reduce(
    (acc, entry) => ({
      ...acc,
      [entry.key]: [],
    }),
    {},
  )

  headingEntries.forEach((entry, idx) => {
    const next = headingEntries[idx + 1]
    const start = entry.index + 1
    const end = next ? next.index : lines.length
    const rawSection = lines.slice(start, end)

    const paragraphs = []
    let buffer = []

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

    sections[entry.key] = paragraphs
  })

  return sections
}

export const buildMonsterNotes = (monster) => {
  const parts = []

  if (monster.typeLine) {
    parts.push(monster.typeLine)
  }

  const defensive = []
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

  const sectionStrings = [
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

export const normalizeDndBeyondUrl = (rawUrl) => {
  if (typeof rawUrl !== 'string') {
    throw new Error('Enter a valid D&D Beyond monster URL.')
  }

  let parsed
  try {
    parsed = new URL(rawUrl, 'https://www.dndbeyond.com')
  } catch {
    throw new Error('Enter a valid D&D Beyond monster URL.')
  }

  if (!parsed.hostname.endsWith('dndbeyond.com')) {
    throw new Error('Enter a D&D Beyond monster URL.')
  }

  if (!parsed.pathname.includes('/monsters/')) {
    throw new Error('Enter a D&D Beyond monster URL.')
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

export const parseDndBeyondMonster = (markdown, sourceUrl) => {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    throw new Error('No monster content was returned from D&D Beyond.')
  }

  const { normalizedUrl, slug, referenceId } = normalizeDndBeyondUrl(sourceUrl)

  const rawLines = markdown
    .split('\n')
    .map((line) => line.replace(/\r/g, ''))
    .filter((line) => !line.trim().startsWith('Dismiss'))

  const commentsIndex = rawLines.findIndex(
    (line) => normalizeHeading(line) === 'comments',
  )
  const relevantLines = commentsIndex === -1 ? rawLines : rawLines.slice(0, commentsIndex)

  let name = ''
  let nameIndex = -1

  for (let index = 0; index < relevantLines.length; index += 1) {
    const trimmed = relevantLines[index].trim()
    if (!trimmed) {
      continue
    }

    const match = trimmed.match(/\[([^\]]+)\]\(https:\/\/www\.dndbeyond\.com\/monsters\//i)
    if (match) {
      const candidate = stripFormatting(match[1])
      if (candidate && candidate.toLowerCase() !== 'skip to content') {
        name = candidate
        nameIndex = index
        break
      }
      continue
    }
  }

  if (!name) {
    throw new Error('Could not locate a monster name in the provided page.')
  }

  let typeLine = ''
  for (let idx = nameIndex + 1; idx < relevantLines.length; idx += 1) {
    const value = stripFormatting(relevantLines[idx])
    if (value) {
      typeLine = value
      break
    }
  }

  const sectionLabels = new Set(SECTION_DEFINITIONS.map((entry) => entry.label))
  const statBlockEndIndex = relevantLines.findIndex((line) =>
    sectionLabels.has(normalizeHeading(line)),
  )
  const statLines =
    statBlockEndIndex === -1
      ? relevantLines
      : relevantLines.slice(0, statBlockEndIndex)

  const statEntries = statLines
    .map((line) => {
      const cleaned = stripFormatting(line)
      return {
        raw: line,
        cleaned,
        lower: cleaned.toLowerCase(),
      }
    })
    .filter((entry) => entry.cleaned)

  const getStatEntry = (labels) => {
    for (const label of labels) {
      const lowerLabel = label.toLowerCase()
      const entry = statEntries.find(
        (item) =>
          item.lower === lowerLabel || item.lower.startsWith(`${lowerLabel} `),
      )
      if (entry) {
        let value = entry.cleaned.slice(label.length)
        value = value.replace(/^[:\s]+/, '').trim()
        return { entry, label, value }
      }
    }
    return null
  }

  const findStatValue = (labels) => {
    const result = getStatEntry(labels)
    return result ? result.value : ''
  }

  const armorClassResult = getStatEntry(['Armor Class', 'AC'])
  let armorClass = null
  let armorNotes = ''
  if (armorClassResult) {
    const match = armorClassResult.value.match(/^(\d+)(?:\s*\(([^)]+)\))?/)
    if (match) {
      armorClass = parseNumeric(match[1])
      if (match[2]) {
        armorNotes = stripFormatting(match[2])
      } else {
        const remainder = armorClassResult.value.slice(match[0].length).trim()
        if (remainder && !remainder.toLowerCase().startsWith('initiative')) {
          armorNotes = remainder
        }
      }
    } else {
      armorClass = parseNumeric(armorClassResult.value)
      armorNotes = armorClassResult.value
    }
  }

  const hitPointsResult = getStatEntry(['Hit Points', 'HP'])
  let hitPoints = null
  let hitDice = ''
  if (hitPointsResult) {
    const match = hitPointsResult.value.match(/^(\d+)(?:\s*\(([^)]+)\))?/)
    if (match) {
      hitPoints = parseNumeric(match[1])
      hitDice = match[2] ? stripFormatting(match[2]) : ''
    } else {
      hitPoints = parseNumeric(hitPointsResult.value)
      hitDice = hitPointsResult.value
    }
  }

  const speed = findStatValue(['Speed'])

  const abilityOrder = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
  const abilityScores = {}

  abilityOrder.forEach((ability) => {
    const abilityLine = statLines.find((line) => {
      const normalized = stripFormatting(line).toUpperCase()
      return normalized.includes(`| ${ability} |`)
    })

    if (abilityLine) {
      const cells = abilityLine
        .split('|')
        .map((cell) => stripFormatting(cell))
        .filter((cell, index, array) => !(index === 0 || index === array.length - 1))
      const score = parseNumeric(cells[1])
      abilityScores[ability.toLowerCase()] = score
    } else {
      abilityScores[ability.toLowerCase()] = null
    }
  })

  const savingThrows = findStatValue(['Saving Throws', 'Saves'])
  const skills = findStatValue(['Skills'])
  const damageVulnerabilities = findStatValue([
    'Damage Vulnerabilities',
    'Vulnerabilities',
  ])
  let damageResistances = findStatValue(['Damage Resistances', 'Resistances'])
  let damageImmunities = findStatValue(['Damage Immunities'])
  let conditionImmunities = findStatValue(['Condition Immunities'])
  const generalImmunities = findStatValue(['Immunities'])
  if (generalImmunities) {
    const lower = generalImmunities.toLowerCase()
    const damageKeywords = [
      'acid',
      'bludgeoning',
      'cold',
      'fire',
      'force',
      'lightning',
      'necrotic',
      'piercing',
      'poison',
      'psychic',
      'radiant',
      'slashing',
      'thunder',
    ]
    const isDamageImmunity = damageKeywords.some((keyword) => lower.includes(keyword))
    if (isDamageImmunity) {
      if (!damageImmunities) {
        damageImmunities = generalImmunities
      }
    } else if (!conditionImmunities) {
      conditionImmunities = generalImmunities
    }
  }
  const senses = findStatValue(['Senses'])
  const languages = findStatValue(['Languages'])
  let proficiencyBonus = findStatValue(['Proficiency Bonus'])
  const challengeResult = getStatEntry(['Challenge', 'CR'])
  let challengeRating = ''
  let challengeXp = ''
  if (challengeResult) {
    const match = challengeResult.value.match(/^([^()]+?)(?:\s*\(([^)]+)\))?$/)
    if (match) {
      challengeRating = stripFormatting(match[1]).trim()
      if (match[2]) {
        const parts = match[2]
          .split(/[;•]/)
          .map((part) => stripFormatting(part).trim())
          .filter(Boolean)
        parts.forEach((part) => {
          if (!challengeXp) {
            const xpMatch = part.match(/xp\s*([0-9,]+)/i)
            if (xpMatch) {
              challengeXp = `XP ${xpMatch[1]}`
              return
            }
          }

          if (!challengeXp && /^xp\b/i.test(part)) {
            const normalizedXp = part.replace(/^xp\s*/i, '').trim()
            if (normalizedXp) {
              challengeXp = `XP ${normalizedXp}`
              return
            }
          }

          if (/pb/i.test(part) && !proficiencyBonus) {
            const pbMatch = part.match(/pb\s*([+-]?\d+)/i)
            if (pbMatch) {
              const numeric = pbMatch[1]
              proficiencyBonus =
                numeric.startsWith('+') || numeric.startsWith('-')
                  ? numeric
                  : `+${numeric}`
            } else {
              const raw = part.replace(/pb/i, '').trim()
              if (raw) {
                proficiencyBonus =
                  raw.startsWith('+') || raw.startsWith('-') ? raw : `+${raw}`
              }
            }
          }
        })
      }
    } else {
      challengeRating = challengeResult.value
    }
  }
  if (proficiencyBonus) {
    const normalized = proficiencyBonus.replace(/^[:\s]+/, '').trim()
    if (normalized && !/^[+-]/.test(normalized)) {
      proficiencyBonus = `+${normalized}`
    } else {
      proficiencyBonus = normalized
    }
  }

  let habitat = ''
  const habitatLine = relevantLines.find((line) =>
    stripFormatting(line).toLowerCase().startsWith('habitat:'),
  )
  if (habitatLine) {
    habitat = stripFormatting(habitatLine).replace(/^Habitat:\s*/i, '')
  }

  let source = ''
  const sourceLine = relevantLines.find((line) => {
    const trimmed = stripFormatting(line)
    if (!trimmed) {
      return false
    }
    const lower = trimmed.toLowerCase()
    if (lower.startsWith('habitat:') || lower.startsWith('treasure:')) {
      return false
    }
    if (lower.startsWith('source:')) {
      return true
    }
    if (/(pg\.?|page)\s*\d+/i.test(trimmed)) {
      return true
    }
    return /(\(\d{4}\))/.test(trimmed)
  })
  if (sourceLine) {
    source = stripFormatting(sourceLine)
  }
  const sections = buildSections(relevantLines)

  const description = sections.description

  const monster = {
    name,
    slug,
    referenceId,
    sourceUrl: normalizedUrl,
    typeLine,
    armorClass,
    armorNotes,
    hitPoints,
    hitDice,
    speed: speed || '',
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
    description,
    habitat,
    source,
  }

  const notes = buildMonsterNotes(monster)

  return {
    ...monster,
    notes,
  }
}


const stripMarkdownLinks = (text) => {
  if (typeof text !== 'string') {
    return ''
  }
  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
}

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
  const sectionOrder = [
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

  const headingEntries = []

  lines.forEach((line, index) => {
    const normalized = normalizeHeading(line)
    const match = sectionOrder.find((entry) => entry.label === normalized)
    if (match) {
      headingEntries.push({ key: match.key, index })
    }
  })

  headingEntries.sort((a, b) => a.index - b.index)

  const sections = {
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    legendaryActions: [],
    mythicActions: [],
    lairActions: [],
    regionalEffects: [],
    description: [],
  }

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

const buildNotes = (monster) => {
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

  relevantLines.some((line, index) => {
    const trimmed = line.trim()
    const match = trimmed.match(/\[([^\]]+)\]\(https:\/\/www\.dndbeyond\.com\/monsters\//i)
    if (match) {
      name = stripFormatting(match[1])
      nameIndex = index
      return true
    }
    return false
  })

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

  const findLineValue = (label) => {
    const lowerLabel = label.toLowerCase()
    const entry = relevantLines.find((line) => {
      const trimmed = stripFormatting(line)
      return trimmed.toLowerCase().startsWith(`${lowerLabel} `)
    })

    if (!entry) {
      return ''
    }

    return stripFormatting(entry).slice(label.length).trim()
  }

  const armorClassRaw = findLineValue('Armor Class')
  let armorClass = null
  let armorNotes = ''
  if (armorClassRaw) {
    const match = armorClassRaw.match(/^(\d+)(?:\s*\(([^)]+)\))?/)
    if (match) {
      armorClass = parseNumeric(match[1])
      armorNotes = match[2] ? stripFormatting(match[2]) : ''
    } else {
      armorClass = parseNumeric(armorClassRaw)
      armorNotes = armorClassRaw
    }
  }

  const hitPointsRaw = findLineValue('Hit Points')
  let hitPoints = null
  let hitDice = ''
  if (hitPointsRaw) {
    const match = hitPointsRaw.match(/^(\d+)(?:\s*\(([^)]+)\))?/)
    if (match) {
      hitPoints = parseNumeric(match[1])
      hitDice = match[2] ? stripFormatting(match[2]) : ''
    } else {
      hitPoints = parseNumeric(hitPointsRaw)
      hitDice = hitPointsRaw
    }
  }

  const speed = findLineValue('Speed')

  const abilityOrder = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
  const abilityScores = {}

  abilityOrder.forEach((ability) => {
    const index = relevantLines.findIndex((line) => stripFormatting(line) === ability)
    if (index !== -1 && index + 1 < relevantLines.length) {
      const valueLine = stripFormatting(relevantLines[index + 1])
      const match = valueLine.match(/^(\d+)/)
      abilityScores[ability.toLowerCase()] = match ? parseNumeric(match[1]) : null
    } else {
      abilityScores[ability.toLowerCase()] = null
    }
  })

  const savingThrows = findLineValue('Saving Throws')
  const skills = findLineValue('Skills')
  const damageVulnerabilities = findLineValue('Damage Vulnerabilities')
  const damageResistances = findLineValue('Damage Resistances')
  const damageImmunities = findLineValue('Damage Immunities')
  const conditionImmunities = findLineValue('Condition Immunities')
  const senses = findLineValue('Senses')
  const languages = findLineValue('Languages')
  const challengeRaw = findLineValue('Challenge')
  let challengeRating = ''
  let challengeXp = ''
  if (challengeRaw) {
    const match = challengeRaw.match(/^([^()]+?)(?:\s*\(([^)]+)\))?$/)
    if (match) {
      challengeRating = stripFormatting(match[1])
      challengeXp = match[2] ? stripFormatting(match[2]) : ''
    } else {
      challengeRating = challengeRaw
    }
  }
  const proficiencyBonus = findLineValue('Proficiency Bonus')

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
    if (trimmed.toLowerCase().startsWith('habitat:')) {
      return false
    }
    return /\(\d{4}\)/.test(trimmed) && trimmed.includes('pg')
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

  const notes = buildNotes(monster)

  return {
    ...monster,
    notes,
  }
}


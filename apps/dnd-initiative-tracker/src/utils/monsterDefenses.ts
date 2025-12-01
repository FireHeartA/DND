export type DefenseCategory = 'damage' | 'condition'

export interface DefenseOption {
  value: string
  label: string
  icon: string
  color: string
  category: DefenseCategory
}

const damageOptions: DefenseOption[] = [
  { value: 'acid', label: 'Acid', icon: '🧪', color: '#7cd8a5', category: 'damage' },
  { value: 'bludgeoning', label: 'Bludgeoning', icon: '🔨', color: '#b3a28f', category: 'damage' },
  { value: 'cold', label: 'Cold', icon: '❄️', color: '#9ad0f5', category: 'damage' },
  { value: 'fire', label: 'Fire', icon: '🔥', color: '#ff9b6a', category: 'damage' },
  { value: 'force', label: 'Force', icon: '🌀', color: '#9f87ff', category: 'damage' },
  { value: 'lightning', label: 'Lightning', icon: '⚡️', color: '#ffd166', category: 'damage' },
  {
    value: 'magical-bludgeoning',
    label: 'Magical Bludgeoning',
    icon: '🪄',
    color: '#cdb4db',
    category: 'damage',
  },
  {
    value: 'magical-piercing',
    label: 'Magical Piercing',
    icon: '🪄',
    color: '#c5e1a5',
    category: 'damage',
  },
  {
    value: 'magical-slashing',
    label: 'Magical Slashing',
    icon: '🪄',
    color: '#bde0fe',
    category: 'damage',
  },
  { value: 'necrotic', label: 'Necrotic', icon: '💀', color: '#9e7b9b', category: 'damage' },
  { value: 'piercing', label: 'Piercing', icon: '🗡️', color: '#d6a85f', category: 'damage' },
  { value: 'poison', label: 'Poison', icon: '☠️', color: '#7fc97f', category: 'damage' },
  { value: 'psychic', label: 'Psychic', icon: '🧠', color: '#85a6ff', category: 'damage' },
  { value: 'radiant', label: 'Radiant', icon: '🌟', color: '#ffd87a', category: 'damage' },
  { value: 'slashing', label: 'Slashing', icon: '🗡️', color: '#e0aaff', category: 'damage' },
  { value: 'thunder', label: 'Thunder', icon: '🌩️', color: '#7cc8ff', category: 'damage' },
]

const conditionOptions: DefenseOption[] = [
  { value: 'blinded', label: 'Blinded', icon: '🙈', color: '#c6b0f5', category: 'condition' },
  { value: 'charmed', label: 'Charmed', icon: '💘', color: '#ffafcc', category: 'condition' },
  { value: 'deafened', label: 'Deafened', icon: '🔇', color: '#b7c9e2', category: 'condition' },
  { value: 'exhaustion', label: 'Exhaustion', icon: '😮‍💨', color: '#cbb8a9', category: 'condition' },
  { value: 'frightened', label: 'Frightened', icon: '😱', color: '#ffb4a2', category: 'condition' },
  { value: 'grappled', label: 'Grappled', icon: '🤼', color: '#f2c57c', category: 'condition' },
  { value: 'incapacitated', label: 'Incapacitated', icon: '🛌', color: '#b8c6db', category: 'condition' },
  { value: 'invisible', label: 'Invisible', icon: '👻', color: '#cad2c5', category: 'condition' },
  { value: 'paralyzed', label: 'Paralyzed', icon: '🧊', color: '#a3c4f3', category: 'condition' },
  { value: 'petrified', label: 'Petrified', icon: '🪨', color: '#c2b8a3', category: 'condition' },
  { value: 'poisoned', label: 'Poisoned', icon: '☠️', color: '#9be0a8', category: 'condition' },
  { value: 'prone', label: 'Prone', icon: '🧎', color: '#ffd6a5', category: 'condition' },
  { value: 'restrained', label: 'Restrained', icon: '⛓️', color: '#c5c3c6', category: 'condition' },
  { value: 'stunned', label: 'Stunned', icon: '💫', color: '#ffcad4', category: 'condition' },
  { value: 'unconscious', label: 'Unconscious', icon: '😴', color: '#cddafd', category: 'condition' },
]

export const MONSTER_DEFENSE_OPTIONS: DefenseOption[] = [...damageOptions, ...conditionOptions]

export const DEFENSE_OPTION_LOOKUP: Record<string, DefenseOption> = MONSTER_DEFENSE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option
    return acc
  },
  {} as Record<string, DefenseOption>,
)

const normalizeDefenseValue = (value: string): string => value.replace(/[^a-z]/gi, '').toLowerCase()

export const parseDefenseList = (rawValue: string): string[] => {
  if (!rawValue || typeof rawValue !== 'string') {
    return []
  }

  const parts = rawValue
    .split(/[,;/]/)
    .flatMap((entry) => entry.split(/\band\b/gi))
    .map((entry) => entry.trim())
    .filter(Boolean)

  const seen = new Set<string>()

  parts.forEach((entry) => {
    const normalized = normalizeDefenseValue(entry)
    const match = MONSTER_DEFENSE_OPTIONS.find((option) => {
      return (
        normalizeDefenseValue(option.value) === normalized ||
        normalizeDefenseValue(option.label) === normalized
      )
    })

    if (match) {
      seen.add(match.value)
    }
  })

  return Array.from(seen)
}

export const isDefenseTag = (tag: string): boolean => {
  const normalized = tag.toLowerCase()
  return (
    normalized.startsWith('vulnerable ') ||
    normalized.startsWith('resist ') ||
    normalized.startsWith('immune ') ||
    normalized.startsWith('condition immune')
  )
}

export const getDefenseChipStyle = (value: string) => {
  const option = DEFENSE_OPTION_LOOKUP[value]
  const backgroundColor = option?.color ? `${option.color}26` : 'rgba(255,255,255,0.08)'
  const borderColor = option?.color || 'rgba(255,255,255,0.25)'
  const color = option?.category === 'condition' ? '#ffffff' : '#1a1626'

  return { backgroundColor, borderColor, color, option }
}

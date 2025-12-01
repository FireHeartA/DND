export type CombatantType = 'player' | 'monster'

export interface CombatantTag {
  title: string
  value: string
}

export interface Combatant {
  id: string
  name: string
  maxHp: number
  currentHp: number
  deathSaveSuccesses: number
  deathSaveFailures: number
  initiative: number
  createdAt: number
  type: CombatantType
  armorClass: number | null
  profileUrl: string
  notes: string
  tags: CombatantTag[]
  damageImmunities: string[]
  damageResistances: string[]
  damageVulnerabilities: string[]
  sourceTemplateId: string | null
  sourceCampaignId: string | null
  sourceMonsterId: string | null
}

export interface PlayerTemplate {
  id: string
  name: string
  maxHp: number
  armorClass: number | null
  profileUrl: string
  notes: string
  createdAt: number
}

export interface CombatState {
  combatants: Combatant[]
  playerTemplates: PlayerTemplate[]
}

export interface CampaignCharacter {
  id: string
  name: string
  maxHp: number
  armorClass: number | null
  profileUrl: string
  notes: string
  tags: string[]
  damageImmunities: string[]
  damageResistances: string[]
  damageVulnerabilities: string[]
  createdAt: number
}

export interface Campaign {
  id: string
  name: string
  notes: string
  createdAt: number
  playerCharacters: CampaignCharacter[]
}

export interface CampaignState {
  campaigns: Campaign[]
  activeCampaignId: string | null
}

export interface MonsterAbilityScores {
  str: number | null
  dex: number | null
  con: number | null
  int: number | null
  wis: number | null
  cha: number | null
}

export interface MonsterDetails {
  id: string
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
  abilityScores: MonsterAbilityScores
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
  importedAt: number
  updatedAt: number
  totalUsageCount: number
  lastUsedAt: number | null
}

export interface MonsterLibraryEntry {
  monsterId: string
  addedAt: number
  usageCount: number
  lastUsedAt: number | null
}

export interface MonsterLibraryState {
  monsters: Record<string, MonsterDetails>
  campaignLibraries: Record<string, MonsterLibraryEntry[]>
  favorites: string[]
}

export interface RootState {
  combat: CombatState
  campaigns: CampaignState
  monsterLibrary: MonsterLibraryState
}

export interface TurnHistoryEntry {
  combatantId: string
  combatantName: string
  startedAt: number
  endedAt: number
  duration: number
}

export interface CombatantTimingStats {
  combatantId: string
  name: string
  totalDuration: number
  turnCount: number
  longestTurn: number
  averageDuration: number
}

export interface CombatStatsSummary {
  totalDuration: number
  totalTurns: number
  averageTurnDuration: number
  longestTurnEntry: TurnHistoryEntry | null
  fastestTurnEntry: TurnHistoryEntry | null
  slowestAverage: CombatantTimingStats | null
  quickestAverage: CombatantTimingStats | null
  combatantStats: CombatantTimingStats[]
}

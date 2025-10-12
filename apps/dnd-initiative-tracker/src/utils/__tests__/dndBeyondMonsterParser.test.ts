import { describe, expect, it } from 'vitest'

import { normalizeDndBeyondUrl, parseDndBeyondMonster } from '../dndBeyondMonsterParser'

const DIRE_WOLF_MARKDOWN = `Title: Dire Wolf

URL Source: https://www.dndbeyond.com/monsters/16841-dire-wolf

Markdown Content:
Dire Wolf - Monsters - D&D Beyond 

===============

Dire Wolf
=========

 Legacy This doesn't reflect the latest rules and lore.[Learn More](https://www.dndbeyond.com/legacy)

[![Image 28: Dire Wolf](https://www.dndbeyond.com/avatars/thumbnails/16/484/1000/1000/636376300478361995.jpeg)](https://www.dndbeyond.com/avatars/thumbnails/16/484/1000/1000/636376300478361995.jpeg)

[Dire Wolf](https://www.dndbeyond.com/monsters/16841-dire-wolf)

Large Beast, Unaligned

![Image 29](https://www.dndbeyond.com/file-attachments/0/579/stat-block-header-bar.svg)

Armor Class 14  (natural armor)

Hit Points 37  (5d10 + 10)

Speed 50 ft.

![Image 30](https://www.dndbeyond.com/file-attachments/0/579/stat-block-header-bar.svg)

STR

17(+3)

DEX

15(+2)

CON

15(+2)

INT

3(-4)

WIS

12(+1)

CHA

7(-2)

![Image 31](https://www.dndbeyond.com/file-attachments/0/579/stat-block-header-bar.svg)

Skills[Perception](https://www.dndbeyond.com/sources/dnd/free-rules/playing-the-game#Skills) +3, [Stealth](https://www.dndbeyond.com/sources/dnd/free-rules/playing-the-game#Skills) +4 

Senses Passive Perception 13 

Languages -- 

Challenge 1 (200 XP) 

Proficiency Bonus +2 

![Image 32](https://www.dndbeyond.com/file-attachments/0/579/stat-block-header-bar.svg)

Traits

_**Keen Hearing and Smell.**_ The wolf has advantage on Wisdom ([Perception](https://www.dndbeyond.com/sources/dnd/free-rules/playing-the-game#Skills)) checks that rely on hearing or smell.

_**Pack Tactics.**_ The wolf has advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally isn't [incapacitated](https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#IncapacitatedCondition).

Actions

_**Bite.** Melee Weapon Attack:_+5 to hit, reach 5 ft., one target. _Hit:_ 10 (2d6 + 3) piercing damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or be knocked [prone](https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#ProneCondition).

Monster Tags: Misc Creature

Habitat: Forest Hill

Basic Rules (2014), pg. 123
`

describe('parseDndBeyondMonster', () => {
  const sourceUrl = 'https://www.dndbeyond.com/monsters/16841-dire-wolf'

  it('parses core stat block data from D&D Beyond markdown', () => {
    const monster = parseDndBeyondMonster(DIRE_WOLF_MARKDOWN, sourceUrl)

    expect(monster.name).toBe('Dire Wolf')
    expect(monster.slug).toBe('dire-wolf')
    expect(monster.referenceId).toBe('16841')
    expect(monster.typeLine).toBe('Large Beast, Unaligned')
    expect(monster.armorClass).toBe(14)
    expect(monster.armorNotes).toBe('natural armor')
    expect(monster.hitPoints).toBe(37)
    expect(monster.hitDice).toBe('5d10 + 10')
    expect(monster.speed).toBe('50 ft.')
    expect(monster.abilityScores).toEqual({
      str: 17,
      dex: 15,
      con: 15,
      int: 3,
      wis: 12,
      cha: 7,
    })
    expect(monster.skills).toBe('Perception +3, Stealth +4')
    expect(monster.senses).toBe('Passive Perception 13')
    expect(monster.languages).toBe('--')
    expect(monster.challengeRating).toBe('1')
    expect(monster.challengeXp).toBe('200 XP')
    expect(monster.proficiencyBonus).toBe('+2')
    expect(monster.habitat).toBe('Forest Hill')
    expect(monster.source).toBe('Basic Rules (2014), pg. 123')
    expect(monster.traits[0]).toMatch(/^Keen Hearing and Smell\./)
    expect(monster.actions[0]).toContain('Bite. Melee Weapon Attack:')
  })

  it('normalizes source URLs and extracts identifiers', () => {
    const normalized = normalizeDndBeyondUrl(sourceUrl)
    expect(normalized.normalizedUrl).toBe('https://www.dndbeyond.com/monsters/16841-dire-wolf')
    expect(normalized.slug).toBe('dire-wolf')
    expect(normalized.referenceId).toBe('16841')
  })
})

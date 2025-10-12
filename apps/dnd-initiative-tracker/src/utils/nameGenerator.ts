const leadingFragments = [
  'Ara',
  'Bel',
  'Cor',
  'Da',
  'El',
  'Fa',
  'Gal',
  'Hel',
  'Iri',
  'Ja',
  'Ka',
  'Lor',
  'My',
  'Nor',
  'Ori',
  'Pha',
  'Qua',
  'Ryn',
  'Sa',
  'Tha',
  'Uri',
  'Va',
  'Wyn',
  'Xa',
  'Ya',
  'Zel',
]

const middleFragments = [
  'bar',
  'cer',
  'dor',
  'fira',
  'gorn',
  'hal',
  'ian',
  'jor',
  'kas',
  'lith',
  'mar',
  'nor',
  'phyr',
  'quor',
  'rion',
  'sira',
  'ther',
  'vash',
  'wyn',
  'zor',
]

const endingFragments = [
  'a',
  'ace',
  'ain',
  'al',
  'ar',
  'en',
  'eth',
  'ia',
  'iel',
  'in',
  'ion',
  'is',
  'or',
  'os',
  'ra',
  'rin',
  'ryn',
  'th',
  'us',
  'yn',
]

const epithets = [
  'the Bold',
  'the Whisper',
  'the Emberclaw',
  'the Moon-Touched',
  'the Ironhide',
  'the Starborn',
  'the Wayfarer',
  'the Silent Fang',
  'the Wild',
  'the Stormbound',
  'the Veilwalker',
  'the Dawnsinger',
]

const randomFrom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

/**
 * Generates a flavorful fantasy-inspired name suitable for creature nicknames.
 */
export const generateFantasyName = (): string => {
  const pattern = Math.random()
  let baseName = ''

  if (pattern < 0.45) {
    baseName = `${randomFrom(leadingFragments)}${randomFrom(endingFragments)}`
  } else if (pattern < 0.85) {
    baseName = `${randomFrom(leadingFragments)}${randomFrom(middleFragments)}${randomFrom(endingFragments)}`
  } else {
    baseName = `${randomFrom(leadingFragments)}${randomFrom(middleFragments)}${randomFrom(middleFragments)}${randomFrom(endingFragments)}`
  }

  if (Math.random() < 0.3) {
    baseName = `${baseName} ${randomFrom(epithets)}`
  }

  return baseName
}

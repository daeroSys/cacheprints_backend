export const FABRIC_SPECS = [
  // Heavyweight (~180–200 GSM)
  { match: 'MICROTECH COMPRESSION', gsm: 200, width: 1.5 },
  { match: 'SPANDEX',              gsm: 200, width: 1.5 },
  { match: 'RIBSTOPS',             gsm: 190, width: 1.5 },
  { match: 'TRIFIT COTTON',        gsm: 180, width: 1.5 },
  { match: 'SOLAR M',              gsm: 180, width: 1.5 },

  // Midweight (~155–170 GSM)
  { match: 'SPORTS MAX',           gsm: 170, width: 1.5 },
  { match: 'POLYMAX',              gsm: 170, width: 1.5 },
  { match: 'POLTYDEX AG',          gsm: 165, width: 1.5 },
  { match: 'POLYTECH',             gsm: 165, width: 1.5 },
  { match: 'POLIFIT CROSS',        gsm: 165, width: 1.5 },
  { match: 'SPUNDY',               gsm: 165, width: 1.5 },
  { match: 'POLYSTRIPES',          gsm: 160, width: 1.5 },
  { match: 'POLYDEX',              gsm: 160, width: 1.5 },
  { match: 'DURAMAX',              gsm: 160, width: 1.5 },
  { match: 'FULLLMAX',             gsm: 160, width: 1.5 },
  { match: 'MICRO DEX',            gsm: 160, width: 1.5 },
  { match: 'SEMI STEP',            gsm: 160, width: 1.5 },
  { match: 'SQUARE KNIT',          gsm: 160, width: 1.5 },
  { match: 'SUBLIDEX',             gsm: 160, width: 1.5 },
  { match: 'HEXA TEX',             gsm: 155, width: 1.5 },
  { match: 'MICRO SHINY',          gsm: 155, width: 1.5 },

  // Lightweight (~130–140 GSM)
  { match: 'MICRO KNIT',           gsm: 140, width: 1.5 },
  { match: 'MICRO-COOL',           gsm: 130, width: 1.5 },
  { match: 'MICRO DOT',            gsm: 135, width: 1.5 },
  { match: 'SEMI COOL',            gsm: 140, width: 1.5 },
  { match: 'SUBLI DOT',            gsm: 140, width: 1.5 },
  { match: 'LYTEX',                gsm: 140, width: 1.5 },
  { match: 'ECOSOFT',              gsm: 135, width: 1.5 },
  { match: 'AIRCOOL',              gsm: 130, width: 1.5 },
  { match: 'ECOFAB',               gsm: 130, width: 1.5 },
  { match: 'POLY LITE',            gsm: 130, width: 1.5 },
]

export function getFabricSpec(name) {
  if (!name) return null
  const n = name.toLowerCase()
  return FABRIC_SPECS.find(spec => n.includes(spec.match.toLowerCase()))
}

export function convertKgToMeters(name, kg) {
  const spec = getFabricSpec(name)
  if (!spec) return Number(kg)
  const meters = (Number(kg) * 1000) / (spec.gsm * spec.width)
  return Math.round(meters * 100) / 100 // Round to 2 decimal places
}

export function isFabricInKg(material) {
  if (!material) return false
  if (material.category && material.category.toLowerCase() === 'fabric') return true
  return !!getFabricSpec(material.name)
}

export function isPaperInPacks(material) {
  if (!material) return false
  return material.category && material.category.toLowerCase() === 'paper'
}

export function convertPacksToSheets(packs) {
  return Number(packs) * 100
}

export function isVinylInRolls(material) {
  if (!material) return false
  return material.category && material.category.toLowerCase() === 'vinyl'
}

export function convertRollsToMeters(rolls) {
  return Number(rolls) * 25
}

export function isThreadInCones(material) {
  if (!material) return false
  return material.category && material.category.toLowerCase() === 'thread'
}

export function convertConesToGrams(cones) {
  return Number(cones) * 1000
}

export const ratingSource = 'https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/how-to-read-food-labels/'

// These are per-100g nutrient levels for solid foods, not a whole-product
// health score, Nutri-Score, legal claim assessment, or personal dietary advice.
export function rateNutrients({ kind, basis, servingGrams, basisReadable, nutrients, issues = [] }) {
  const unavailable = reason => ({ status: 'unavailable', reason, items: [], source: ratingSource })
  if (issues.length) return unavailable('Resolve inconsistent readings before rating this label.')
  if (kind !== 'solid') return unavailable('This rating method only covers solid foods.')
  if (!basisReadable || !['per100g', 'perServing'].includes(basis)) return unavailable('The nutrition column basis could not be established.')
  if (basis === 'perServing' && !(servingGrams > 0)) return unavailable('A readable serving weight in grams is required.')
  const factor = basis === 'per100g' ? 1 : 100 / servingGrams
  const definitions = [
    ['fat', 'Total fat', 3, 17.5],
    ['saturated_fat', 'Saturated fat', 1.5, 5],
    ['sugars', 'Total sugars', 5, 22.5],
    ['salt', 'Salt', 0.3, 1.5],
  ]
  const items = definitions.map(([key, name, low, high]) => {
    let entry = nutrients.find(n => n.key === key)
    let converted = false
    if (!entry && key === 'salt') {
      entry = nutrients.find(n => n.key === 'sodium')
      converted = Boolean(entry)
    }
    if (!entry || entry.readability !== 'clear' || entry.qualifier !== 'exact' || !Number.isFinite(entry.value) || entry.value < 0 || !['g', 'mg'].includes(entry.unit)) {
      return { name, level: 'unknown', value: null }
    }
    const value = entry.value * (entry.unit === 'mg' ? 0.001 : 1) * (converted ? 2.5 : 1) * factor
    if (value > 100) return { name, level: 'unknown', value: null }
    return { name, level: value <= low ? 'low' : value > high ? 'high' : 'medium', value: Math.round(value * 100) / 100, converted }
  })
  return {
    status: items.every(item => item.level !== 'unknown') ? 'complete' : 'partial',
    reason: 'Nutrient levels per 100g using NHS food-label guidance. This is not an overall product health score.',
    items, source: ratingSource,
  }
}

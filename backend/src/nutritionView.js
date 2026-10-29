const comparisonSource = {
  title: 'NHS: How to read food labels',
  url: 'https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/how-to-read-food-labels/',
}

const bandRules = [
  { key: 'total-fat', label: 'Fat', unit: 'g', low: 3, high: 17.5 },
  { key: 'saturated-fat', label: 'Saturated fat', unit: 'g', low: 1.5, high: 5 },
  { key: 'total-sugars', label: 'Total sugars', unit: 'g', low: 5, high: 22.5 },
  { key: 'sodium', label: 'Sodium', unit: 'mg', low: 100, high: 600 },
]

const round = value => Math.round(value * 100) / 100

function scaleNutrient(nutrient, factor) {
  if (!Number.isFinite(factor) || !Number.isFinite(nutrient.value)) return null
  return { value: round(nutrient.value * factor), unit: nutrient.unit }
}

function amountPer100g(nutrient, report) {
  if (report.basis === 'per100g') return { value: nutrient.value, unit: nutrient.unit }
  if (report.basis === 'perServing' && report.servingGrams > 0) return scaleNutrient(nutrient, 100 / report.servingGrams)
  return null
}

function bandFor(value, low, high) {
  if (value <= low) return 'low'
  if (value > high) return 'high'
  return 'medium'
}

function makeInsights(nutrients, report) {
  return bandRules.map(rule => {
    const nutrient = nutrients.find(item => item.key === rule.key)
    const normalized = nutrient && amountPer100g(nutrient, report)
    const unitMatches = normalized && normalized.unit === rule.unit
    const issue = report.issues?.some(item => item.line.toLowerCase().includes(rule.label.toLowerCase()))
    if (report.basis === 'per100ml') {
      return { ...rule, level: 'unknown', valuePer100g: null, explanation: 'The available comparison bands are for foods per 100 g and are not applied to drinks.' }
    }
    if (issue || !nutrient || !unitMatches || nutrient.confidence !== 'clear' || nutrient.qualifier !== 'exact') {
      return { ...rule, level: 'unknown', valuePer100g: null, explanation: 'A clear amount and per-100 g basis are needed for this comparison.' }
    }
    const level = bandFor(normalized.value, rule.low, rule.high)
    const value = round(normalized.value)
    const explanation = level === 'low'
      ? `${value} ${rule.unit} per 100 g is within the NHS low band.`
      : level === 'high'
        ? `${value} ${rule.unit} per 100 g is above the NHS high band.`
        : `${value} ${rule.unit} per 100 g is between the NHS low and high bands.`
    return { ...rule, level, valuePer100g: value, explanation }
  })
}

export function buildNutritionView(report) {
  const servingAmount = report.basis === 'per100ml' ? report.servingMl : report.servingGrams
  const packageAmount = report.basis === 'per100ml' ? report.netVolumeMl : report.netWeightGrams
  const servingFactor = report.basis === 'perServing'
    ? 1
    : ['per100g', 'per100ml'].includes(report.basis) && servingAmount > 0
      ? servingAmount / 100 : null
  let packFactor = null
  if (report.basis === 'perServing' && report.servingsPerContainer > 0) packFactor = report.servingsPerContainer
  else if (['per100g', 'per100ml'].includes(report.basis) && packageAmount > 0) packFactor = packageAmount / 100
  else if (['per100g', 'per100ml'].includes(report.basis) && report.servingsPerContainer > 0 && servingAmount > 0) {
    packFactor = report.servingsPerContainer * servingAmount / 100
  }

  const nutrients = report.nutrients.map(nutrient => {
    const asRead = nutrient[report.basis] || scaleNutrient(nutrient, 1)
    const per100g = nutrient.per100g || (report.basis === 'per100g'
      ? scaleNutrient(nutrient, 1)
      : report.basis === 'perServing' && report.servingGrams > 0
        ? scaleNutrient(nutrient, 100 / report.servingGrams) : null)
    const per100ml = nutrient.per100ml || (report.basis === 'per100ml'
      ? scaleNutrient(nutrient, 1)
      : report.basis === 'perServing' && report.servingMl > 0
        ? scaleNutrient(nutrient, 100 / report.servingMl) : null)
    const perServing = nutrient.perServing || (servingFactor === null ? null : scaleNutrient(nutrient, servingFactor))
    const wholePackFromServing = nutrient.perServing && report.servingsPerContainer > 0
      ? scaleNutrient(nutrient.perServing, report.servingsPerContainer)
      : null
    return {
      key: nutrient.key,
      name: nutrient.name,
      unit: nutrient.unit,
      asRead,
      per100g,
      per100ml,
      perServing,
      wholePack: wholePackFromServing || (packFactor === null ? null : scaleNutrient(nutrient, packFactor)),
    }
  })

  return {
    columns: {
      perServing: report.nutritionColumns?.includes('perServing') || servingFactor !== null,
      perServingSource: report.nutritionColumns?.includes('perServing') ? 'printed' : servingFactor !== null ? 'calculated' : null,
      per100g: report.nutritionColumns?.includes('per100g') || report.basis === 'per100g',
      per100ml: report.nutritionColumns?.includes('per100ml') || report.basis === 'per100ml',
      wholePack: packFactor !== null,
      servingsPerContainer: report.servingsPerContainer || null,
      servingsSource: report.servingsSource || null,
      wholePackSource: report.basis === 'perServing' ? report.servingsSource || null : packageAmount > 0 ? 'net-package-amount' : report.servingsSource || null,
      serving: report.serving || null,
      netWeightGrams: report.netWeightGrams || null,
      netVolumeMl: report.netVolumeMl || null,
      basis: report.basis,
    },
    nutrients,
    insights: makeInsights(report.nutrients, report),
    comparisonSource,
    notes: [
      'Low, medium, and high bands use NHS per-100 g food-label guidance as a comparison reference; they are not an India-specific legal standard or an overall health score.',
      'Per-serving and whole-pack amounts are calculated only when the serving basis and package quantity can be read or derived from the label.',
    ],
  }
}

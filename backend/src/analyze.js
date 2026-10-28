const nutrientDefinitions = [
  { key: 'saturated-fat', name: 'Saturated fat', pattern: /^(?:saturated\s+fat|sat(?:urated)?\.?\s*fat)\b/i, unit: 'g' },
  { key: 'trans-fat', name: 'Trans fat', pattern: /^trans\s+fat\b/i, unit: 'g' },
  { key: 'added-sugars', name: 'Added sugars', pattern: /^added\s+sugars?\b/i, unit: 'g' },
  { key: 'total-fat', name: 'Total fat', pattern: /^(?:total\s+)?fat\b/i, unit: 'g' },
  { key: 'cholesterol', name: 'Cholesterol', pattern: /^cholesterol\b/i, unit: 'mg' },
  { key: 'sodium', name: 'Sodium', pattern: /^sodium\b/i, unit: 'mg' },
  { key: 'dietary-fiber', name: 'Dietary fiber', pattern: /^(?:dietary\s+)?fib(?:er|re)\b/i, unit: 'g' },
  { key: 'total-carbohydrate', name: 'Total carbohydrate', pattern: /^(?:total\s+)?carbohydrates?\b/i, unit: 'g' },
  { key: 'total-sugars', name: 'Total sugars', pattern: /^(?:total\s+)?sugars?\b/i, unit: 'g' },
  { key: 'protein', name: 'Protein', pattern: /^protein\b/i, unit: 'g' },
  { key: 'energy', name: 'Calories', pattern: /^(?:calories|energy)\b/i, unit: 'kcal' },
]
const valueWithUnit = /(?:^|\s)(less\s+than\s+|<\s*)?(\d{1,4}(?:[.,]\d+)?)\s*(kcal|kj|mg|g)\b/i
const valueWithoutUnit = /(?:^|\s)(\d{1,4}(?:[.,]\d+)?)\s*(?!%)(?:$|\s)/
const sectionPattern = /^(?:contains|may contain|allergen(?:s| information)?|storage|directions|manufactur(?:er|ed)|best before|nutrition(?:al)?(?: facts| information)?|servings?\b|per\s+\d|%\s*daily\s*value|amount\s+per\s+serving)/i
const percentPattern = /\d+(?:[.,]\d+)?\s*%/

function matchHeading(line, heading) {
  return line.match(new RegExp('^' + heading + '\\s*[:：]?\\s+(.+)$', 'i'))?.[1]?.trim() || null
}

function readNutrient(line, definition) {
  const remainder = line.replace(definition.pattern, '').replace(/^\s*[:：-]?\s*/, '')
  let match = remainder.match(valueWithUnit)
  if (!match && definition.key === 'energy') match = remainder.match(valueWithoutUnit)
  if (!match) return null
  const hasUnit = Boolean(match[3])
  const rawValue = Number((hasUnit ? match[2] : match[1]).replace(',', '.'))
  const rawUnit = hasUnit ? match[3].toLowerCase() : definition.unit
  if (!Number.isFinite(rawValue) || rawValue < 0) return null
  return { key: definition.key, name: definition.name, value: rawValue, unit: rawUnit, qualifier: hasUnit && match[1] ? 'less-than' : 'exact', raw: line.trim(), confidence: hasUnit ? 'clear' : 'estimated-unit' }
}

function parseBasis(text) {
  if (/\bper\s*100\s*(?:g|grams?)\b|\b100\s*g\s*(?:basis)?\b/i.test(text)) return 'per100g'
  if (/\bper\s*100\s*(?:ml|millilitres?|milliliters?)\b/i.test(text)) return 'per100ml'
  if (/\b(?:amount\s+)?per\s+serving\b|\bserving\s+size\b/i.test(text)) return 'perServing'
  return 'unknown'
}

export function analyze(label, frontText = '') {
  const originalLines = label.replace(/\u00a0/g, ' ').split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const lines = []
  for (let index = 0; index < originalLines.length; index++) {
    let line = originalLines[index]
    if (/^(?:calories|energy|total\s+fat|fat|saturated\s+fat|trans\s+fat|cholesterol|sodium|total\s+carbohydrates?|carbohydrates?|dietary\s+fib(?:er|re)|fib(?:er|re)|added\s+sugars?|total\s+sugars?|sugars?|protein)\b/i.test(line) && !nutrientDefinitions.some(def => readNutrient(line, def)) && originalLines[index + 1]) {
      line += ' ' + originalLines[index + 1]
      index++
    }
    lines.push(line)
  }

  let name = 'Your food label'
  let serving = null
  let ingredients = null
  let readingIngredients = false
  const nutrients = []
  const issues = []
  const notes = []

  for (const line of lines) {
    const product = matchHeading(line, 'product')
    const portion = matchHeading(line, 'serving size')
    const ingredientStart = line.match(/^ingredients\s*[:：]?\s*(.*)$/i)
    const definition = nutrientDefinitions.find(item => item.pattern.test(line))
    if (product || portion || ingredientStart || definition || sectionPattern.test(line)) readingIngredients = false
    if (product) { name = product; continue }
    if (portion) { serving = portion; continue }
    if (ingredientStart) { ingredients = ingredientStart[1]; readingIngredients = true; continue }
    if (readingIngredients) { ingredients = [ingredients, line].filter(Boolean).join(' '); continue }
    if (!definition) continue
    const parsed = readNutrient(line, definition)
    if (!parsed) {
      issues.push({ line, reason: percentPattern.test(line) ? 'A daily-value percentage was seen, but no nutrient amount and unit could be separated.' : 'The amount or unit could not be read confidently.' })
      continue
    }
    const duplicate = nutrients.find(item => item.key === parsed.key)
    if (duplicate) {
      issues.push({ line, reason: 'More than one row matched this nutrient. The first reading was kept; check the photo.' })
      continue
    }
    nutrients.push(parsed)
  }

  const basis = parseBasis(label)
  if (!serving) notes.push('Serving size was not found. Confirm whether values are per serving or per 100g.')
  if (basis === 'unknown') notes.push('The nutrition basis (per serving or per 100g) could not be identified, so values are shown exactly as read and are not normalized.')
  if (!nutrients.length) notes.push('No nutrient amounts were confidently recognized. Retake a close, straight-on photo or correct the extracted text.')
  if (!ingredients) notes.push('Ingredients could not be identified in the supplied text.')
  notes.push('Nutrition values are transcribed from the label. Check each amount against the package; OCR can confuse digits and units.')
  return {
    name, serving, basis, nutrients, issues, ingredients: ingredients || null, notes,
    suggestedClaims: suggestClaims(frontText),
  }
}

export function suggestClaims(frontText = '') {
  const text = frontText.toLowerCase().replace(/[^a-z0-9%\s-]/g, ' ')
  const patterns = [
    ['no-added-sugar', /\bno\s+added\s+sugar\b/],
    ['no-sugar', /\b(?:no\s+sugar|sugar\s*[- ]?free|zero\s+sugar)\b/],
    ['multigrain', /\bmultigrain\b|\bmulti\s+grain\b/],
    ['no-preservatives', /\bno\s+preservatives?\b|\bpreservative\s+free\b/],
    ['high-protein', /\bhigh\s+(?:in\s+)?protein\b/],
  ]
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([id]) => id)
}

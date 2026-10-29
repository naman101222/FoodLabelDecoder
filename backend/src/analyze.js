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
  { key: 'energy', name: 'Energy', pattern: /^(?:calories|energy)\b/i, unit: 'kcal' },
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
  const declaredUnit = line.match(/\(\s*(kcal|kj|mg|g)\s*\)/i)?.[1]?.toLowerCase() || null
  let match = remainder.match(valueWithUnit)
  let rawValue
  let rawUnit
  let qualifier
  let confidence
  if (match) {
    const hasUnit = Boolean(match[3])
    rawValue = Number((hasUnit ? match[2] : match[1]).replace(',', '.'))
    rawUnit = hasUnit ? match[3].toLowerCase() : declaredUnit
    qualifier = hasUnit && match[1] ? 'less-than' : 'exact'
    confidence = hasUnit || declaredUnit ? 'clear' : 'estimated-unit'
  } else {
    const firstValueCell = remainder.includes('|') ? remainder.split('|')[1] : remainder
    const cellValue = firstValueCell.match(/^\s*(less\s+than\s+|<\s*)?(\d{1,4}(?:[.,]\d+)?)(?=\s|%|$)/i)
    if (!cellValue || (!declaredUnit && definition.key !== 'energy')) return null
    rawValue = Number(cellValue[2].replace(',', '.'))
    rawUnit = declaredUnit || definition.unit
    qualifier = cellValue[1] ? 'less-than' : 'exact'
    confidence = declaredUnit ? 'clear' : 'estimated-unit'
  }
  if (!Number.isFinite(rawValue) || rawValue < 0) return null
  return { key: definition.key, name: definition.name, value: rawValue, unit: rawUnit, qualifier, raw: line.trim(), confidence }
}

function parseBasis(text) {
  const per100g = /\bper\s*100\s*(?:g|grams?)\b|\b100\s*g\s*(?:basis)?\b/i.test(text)
  const per100ml = /\bper\s*100\s*(?:ml|millilitres?|milliliters?)\b/i.test(text)
  const perServing = /\b(?:amount\s+)?per\s+serv(?:ing|e)\b/i.test(text)
  const explicitBases = [per100g, per100ml, perServing].filter(Boolean).length
  if (explicitBases > 1) return 'unknown'
  if (per100g) return 'per100g'
  if (per100ml) return 'per100ml'
  if (perServing) return 'perServing'
  return 'unknown'
}

function parseGrams(text) {
  const values = [...(text || '').matchAll(/(\d+(?:[.,]\d+)?)\s*g\b/gi)]
  return values.length ? Number(values.at(-1)[1].replace(',', '.')) : null
}

function parseMillilitres(text) {
  const values = [...(text || '').matchAll(/(\d+(?:[.,]\d+)?)\s*m[lL]\b/g)]
  return values.length ? Number(values.at(-1)[1].replace(',', '.')) : null
}

function parsePackageFacts(lines, serving) {
  let servingsPerContainer = null
  let netWeightGrams = null
  let netVolumeMl = null
  for (const line of lines) {
    const count = line.match(/(?:servings?\s+per\s+(?:container|pack|package)|no\.?\s*of\s+servings?\s+in\s+(?:the\s+)?(?:pack|package))\s*[:：-]?\s*(\d+(?:[.,]\d+)?)/i)
    if (count) servingsPerContainer = Number(count[1].replace(',', '.'))
    const quantity = line.match(/(?:net\s*(?:weight|wt|volume)\.?|package\s*(?:weight|volume))\s*[:：-]?\s*(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)\b/i)
    if (quantity) {
      const value = Number(quantity[1].replace(',', '.'))
      const unit = quantity[2].toLowerCase()
      if (unit === 'g' || unit === 'kg') netWeightGrams = value * (unit === 'kg' ? 1000 : 1)
      else netVolumeMl = value * (unit === 'l' ? 1000 : 1)
    }
  }
  const servingGrams = parseGrams(serving)
  const servingMl = parseMillilitres(serving)
  let servingsSource = servingsPerContainer ? 'printed' : null
  const packageAmount = netWeightGrams || netVolumeMl
  const servingAmount = servingGrams || servingMl
  if (!servingsPerContainer && packageAmount && servingAmount) {
    const ratio = packageAmount / servingAmount
    if (ratio >= 0.8 && ratio <= 100 && Math.abs(ratio - Math.round(ratio)) < 0.06) {
      servingsPerContainer = Math.round(ratio)
      servingsSource = 'estimated-from-pack-weight'
    }
  }
  return { servingGrams, servingMl, servingsPerContainer, servingsSource, netWeightGrams, netVolumeMl }
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
  let servingsPerContainer = null
  let servingsSource = null
  let netWeightGrams = null
  let ingredients = null
  let readingIngredients = false
  const nutrients = []
  const issues = []
  const notes = []

  for (const line of lines) {
    const product = matchHeading(line, 'product')
    const portion = matchHeading(line, 'serving size')?.replace(/^is\s+/i, '')
    const ingredientStart = line.match(/^ingredients\s*[:：]?\s*(.*)$/i)
    const nutrientLine = line.replace(/^[\s|•*–—-]+/, '')
    const definition = nutrientDefinitions.find(item => item.pattern.test(nutrientLine))
    if (product || portion || ingredientStart || definition || sectionPattern.test(line)) readingIngredients = false
    if (product) { name = product; continue }
    if (portion) { serving = portion; continue }
    if (ingredientStart) { ingredients = ingredientStart[1]; readingIngredients = true; continue }
    if (readingIngredients) { ingredients = [ingredients, line].filter(Boolean).join(' '); continue }
    if (!definition) continue
    const parsed = readNutrient(nutrientLine, definition)
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
  const packageFacts = parsePackageFacts(originalLines, serving)
  servingsPerContainer = packageFacts.servingsPerContainer
  servingsSource = packageFacts.servingsSource
  netWeightGrams = packageFacts.netWeightGrams
  if (!serving) notes.push('Serving size was not found. Confirm whether values are per serving or per 100g.')
  if (basis === 'unknown') notes.push('The nutrition basis (per serving or per 100g) could not be identified, so values are shown exactly as read and are not normalized.')
  if (!nutrients.length) notes.push('No nutrient amounts were confidently recognized. Retake a close, straight-on photo or correct the extracted text.')
  if (!ingredients) notes.push('Ingredients could not be identified in the supplied text.')
  notes.push('Nutrition values are transcribed from the label. Check each amount against the package; OCR can confuse digits and units.')
  return {
    name, serving, basis, nutrients, issues, ingredients: ingredients || null, notes,
    servingGrams: packageFacts.servingGrams, servingMl: packageFacts.servingMl,
    servingsPerContainer, servingsSource, netWeightGrams, netVolumeMl: packageFacts.netVolumeMl,
    suggestedClaims: suggestClaims(frontText),
  }
}

const structuredKinds = new Set(['per100g', 'per100ml', 'perServing', 'dailyValue', 'other'])
const normalizeHeader = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')

function structuredAmount(value, fallbackUnit) {
  const match = String(value || '').match(/^\s*(less\s+than\s+|<\s*)?(\d{1,5}(?:[.,]\d+)?)\s*(kcal|kj|mg|g|mcg|µg|ug)?\s*$/i)
  if (!match) return null
  const unit = (match[3] || fallbackUnit || '').toLowerCase()
  if (!unit || /\[unclear\]/i.test(value)) return null
  return {
    value: Number(match[2].replace(',', '.')),
    unit: unit === 'ug' ? 'µg' : unit,
    qualifier: match[1] ? 'less-than' : 'exact',
    confidence: match[3] || fallbackUnit ? 'clear' : 'estimated-unit',
  }
}

export function applyStructuredNutrition(report, nutritionData) {
  if (!nutritionData || !Array.isArray(nutritionData.columns) || !Array.isArray(nutritionData.nutrients)) return report

  const columns = nutritionData.columns
    .filter(column => column && typeof column.label === 'string' && structuredKinds.has(column.kind))
    .slice(0, 20)
  const kinds = new Set(columns.map(column => column.kind))
  const basis = ['per100g', 'per100ml', 'perServing'].find(kind => kinds.has(kind)) || 'unknown'
  const serving = typeof nutritionData.servingSize === 'string' && nutritionData.servingSize.trim()
    ? nutritionData.servingSize.trim()
    : report.serving
  const servingCountText = String(nutritionData.servingsPerContainer || '').trim()
  const servingCount = /^\d+(?:[.,]\d+)?$/.test(servingCountText)
    ? Number(servingCountText.replace(',', '.'))
    : report.servingsPerContainer
  const issues = []
  const nutrients = []

  if (basis !== 'unknown') {
    for (const row of nutritionData.nutrients.slice(0, 80)) {
      if (!row || typeof row.name !== 'string' || !Array.isArray(row.cells)) continue
      const rowName = row.name.trim().replace(/^(?:of\s+which|including)\s+/i, '')
      const definition = nutrientDefinitions.find(item => item.pattern.test(rowName))
      const key = definition?.key || rowName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (!key) continue
      const amountFor = kind => {
        const labels = columns.filter(column => column.kind === kind).map(column => normalizeHeader(column.label))
        const cell = row.cells.find(candidate => labels.includes(normalizeHeader(candidate.column)))
        if (!cell) return null
        const declaredUnit = rowName.match(/\(\s*(kcal|kj|mg|g|mcg|µg|ug)\s*\)/i)?.[1] || definition?.unit
        return structuredAmount(cell.value, declaredUnit)
      }
      const primary = amountFor(basis)
      if (!primary) {
        issues.push({ line: row.name, reason: `Gemini could not confidently read a value from the printed ${basis === 'perServing' ? 'per-serving' : basis === 'per100ml' ? 'per-100-ml' : 'per-100-g'} column for this row.` })
        continue
      }
      if (nutrients.some(item => item.key === key)) {
        issues.push({ line: row.name, reason: 'Gemini returned more than one row for this nutrient; the first row was kept.' })
        continue
      }
      nutrients.push({
        key,
        name: definition?.name || rowName.replace(/\s*\([^)]*\)\s*$/, ''),
        value: primary.value,
        unit: primary.unit,
        qualifier: primary.qualifier,
        confidence: primary.confidence,
        raw: row.name,
        ...(basis === 'per100g' ? { per100g: primary } : {}),
        ...(basis === 'per100ml' ? { per100ml: primary } : {}),
        ...(basis === 'perServing' ? { perServing: primary } : {}),
        ...(kinds.has('per100g') && basis !== 'per100g' && amountFor('per100g') ? { per100g: amountFor('per100g') } : {}),
        ...(kinds.has('per100ml') && basis !== 'per100ml' && amountFor('per100ml') ? { per100ml: amountFor('per100ml') } : {}),
        ...(kinds.has('perServing') && basis !== 'perServing' && amountFor('perServing') ? { perServing: amountFor('perServing') } : {}),
      })
    }
  } else {
    issues.push({
      line: 'Nutrition column headings',
      reason: 'Gemini could not identify an explicit per-100-g, per-100-ml, or per-serving column. Amounts are withheld instead of being assigned to a guessed basis.',
    })
  }

  const notes = report.notes.filter(note => !/nutrition basis|no nutrient amounts|nutrition values are transcribed/i.test(note))
  if (basis === 'unknown') notes.push('Nutrition amounts are withheld because the table column basis could not be identified.')
  else notes.push('Gemini matched nutrient cells to their printed column headings. Check the transcription against the package before relying on the values.')
  if (!nutrients.length && basis !== 'unknown') notes.push('No nutrient amounts were confidently read from the selected nutrition column.')

  return {
    ...report,
    serving,
    servingGrams: parseGrams(serving || ''),
    servingMl: parseMillilitres(serving || ''),
    servingsPerContainer: servingCount,
    basis,
    nutrients,
    issues,
    notes,
    nutritionColumns: [...kinds],
  }
}

export function suggestClaims(frontText = '') {
  const text = frontText.toLowerCase().replace(/[^a-z0-9%\s-]/g, ' ')
  const patterns = [
    ['no-added-sugar', /\bno\s+added\s+sugar\b/],
    ['sugar-free', /\b(?:no\s+sugar|sugar\s*[- ]?free|zero\s+sugar)\b/],
    ['high-protein', /\bhigh\s+(?:in\s+)?protein\b/],
    ['low-fat', /\blow\s+fat\b/],
    ['trans-fat-free', /\btrans\s*[- ]?fat\s*[- ]?free\b/],
  ]
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([id]) => id)
}

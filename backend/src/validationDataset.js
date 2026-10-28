import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const csvPath = fileURLToPath(new URL('../data/packaged_foods_india.csv', import.meta.url))
const fields = ['Calories_kcal', 'Carbohydrates_g', 'Proteins_g', 'Total_Fat_g', 'Saturated_Fat_g', 'Trans_Fat_g', 'Sugar_g', 'Sodium_mg', 'Dietary_Fiber_g']

function parseCsv(text) {
  const rows = []
  let row = [], value = '', quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"' && quoted && text[index + 1] === '"') { value += char; index++ }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(value); value = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index++
      row.push(value); value = ''
      if (row.some(cell => cell.trim())) rows.push(row)
      row = []
    } else value += char
  }
  if (value || row.length) { row.push(value); rows.push(row) }
  const [headers, ...records] = rows
  return records.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
}

const products = parseCsv(readFileSync(csvPath, 'utf8'))

function words(value = '') {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(word => word.length > 2))
}
function overlap(left, right) {
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared++
  return shared / Math.min(left.size, right.size)
}
function readNumber(value) {
  const result = Number.parseFloat(String(value).replace(/[^0-9.]/g, ''))
  return Number.isFinite(result) ? result : null
}

export function datasetInfo() {
  return { name: 'packaged_foods_india.csv', records: products.length, purpose: 'candidate-product and nutrient cross-check only', source: 'User-supplied Kaggle CSV; provenance URL has not been recorded.' }
}

function normalizeIngredient(value = '') {
  return value.toLowerCase().replace(/\bins?\s*/g, 'ins ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

const ingredientRecords = products.flatMap(product => String(product.Ingredients || '').split(/[,;\n]+/).map(raw => ({
  normalized: normalizeIngredient(raw.replace(/[()[\]]/g, ' ')),
  product: product['Item name'],
}))).filter(item => item.normalized.length > 2)

export function findIngredientInDataset(ingredient) {
  const normalized = normalizeIngredient(ingredient.replace(/[()[\]]/g, ' '))
  if (!normalized) return null
  const exact = ingredientRecords.filter(item => item.normalized === normalized)
  if (exact.length) return { match: exact[0].normalized, productCount: new Set(exact.map(item => item.product)).size }
  const tokenSet = new Set(normalized.split(' ').filter(token => token.length > 2))
  const candidates = ingredientRecords.filter(item => {
    const tokens = item.normalized.split(' ').filter(token => token.length > 2)
    return tokens.length > 0 && tokens.every(token => tokenSet.has(token))
  })
  if (!candidates.length || normalized.split(' ').length > 8) return null
  return { match: candidates[0].normalized, productCount: new Set(candidates.map(item => item.product)).size }
}

export function findDatasetMatches({ label = '', frontText = '', ingredients = '' }) {
  const query = words(`${frontText} ${label} ${ingredients}`)
  const candidates = products.map(product => {
    const identity = overlap(query, words(`${product['Item name']} ${product.Brand_Name}`))
    const ingredientOverlap = overlap(words(ingredients), words(product.Ingredients))
    return { product, identity, ingredientOverlap, evidence: identity + ingredientOverlap }
  }).filter(candidate => candidate.evidence >= 0.34).sort((a, b) => b.evidence - a.evidence).slice(0, 3)
  return {
    dataset: datasetInfo(),
    status: candidates.length ? 'candidate-match-found' : 'no-candidate-match',
    message: candidates.length ? 'Possible products were found by matching OCR text with the local dataset. Confirm the package name and values before relying on a match.' : 'No reliable product candidate was found in the local dataset. The report uses only the text read from the package.',
    candidates: candidates.map(({ product, identity, ingredientOverlap }) => ({
      itemName: product['Item name'], brand: product.Brand_Name, category: product.Category, subCategory: product.Sub_Category,
      matchEvidence: [identity >= 0.34 && 'product or brand words', ingredientOverlap >= 0.34 && 'ingredient words'].filter(Boolean),
      ingredients: product.Ingredients,
      nutrients: Object.fromEntries(fields.map(field => [field, readNumber(product[field])]).filter(([, value]) => value !== null)),
    })),
  }
}

import { ingredientProfile } from './ingredients.js'

export class ServiceError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export async function lookupProduct(barcode, fetcher = fetch) {
  if (!/^\d{8,14}$/.test(barcode)) throw new ServiceError(400, 'Enter the 8–14 digit barcode printed on the pack.')
  const url = new URL('https://world.openfoodfacts.org/api/v3/product/' + barcode)
  url.searchParams.set('fields', 'code,product_name,brands,ingredients_text,nutriments,nutriscore_grade,serving_size')
  let response
  try {
    response = await fetcher(url, {
      headers: { 'User-Agent': 'FoodLabelDecoder/0.1 (https://github.com/naman101222/FoodLabelDecoder)' },
      signal: AbortSignal.timeout(15000),
    })
  } catch { throw new ServiceError(503, 'Open Food Facts could not be reached. Try again or use a label photo.') }
  if (response.status === 404) throw new ServiceError(404, 'This barcode was not found. Use a label photo or manual input.')
  if (!response.ok) throw new ServiceError(503, 'Open Food Facts is temporarily unavailable.')
  const data = await response.json()
  if (!data.product) throw new ServiceError(404, 'This barcode was not found. Use a label photo or manual input.')
  const product = data.product
  const definitions = [
    ['energy-kcal', 'Energy', 'kcal'], ['fat', 'Total fat', 'g'], ['saturated-fat', 'Saturated fat', 'g'],
    ['carbohydrates', 'Carbohydrates', 'g'], ['sugars', 'Total sugars', 'g'],
    ['proteins', 'Protein', 'g'], ['fiber', 'Fibre', 'g'], ['salt', 'Salt', 'g'], ['sodium', 'Sodium', 'g'],
  ]
  const nutrients = definitions.flatMap(([key, name, unit]) => {
    const value = product.nutriments?.[key + '_100g']
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? [{ name, value, unit }] : []
  })
  return {
    name: product.product_name || 'Product ' + barcode,
    brand: product.brands || null, serving: product.serving_size || null,
    basisLabel: 'Database values per 100g / 100ml; check the package.',
    nutrients, ingredients: product.ingredients_text || null,
    source: 'Open Food Facts', sourceUrl: 'https://world.openfoodfacts.org/product/' + barcode,
    databaseGrade: /^[a-e]$/i.test(product.nutriscore_grade || '') ? product.nutriscore_grade.toUpperCase() : null,
    ingredientProfile: ingredientProfile(product.ingredients_text || ''),
    claims: [], hasFrontText: false,
    notes: ['Confirm the product name and barcode match your pack. Community data may be incomplete or outdated.', 'Open Food Facts data is licensed under ODbL. A database Nutri-Score, when available, is supplied by Open Food Facts, not computed by this app.'],
  }
}

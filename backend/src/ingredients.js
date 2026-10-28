import { findIngredientInDataset } from './validationDataset.js'

export const sources = [
  { name: 'FDA: ingredient functions', url: 'https://www.fda.gov/food/food-additives-and-gras-ingredients-information-consumers/types-food-ingredients' },
  { name: 'WHO: food additives', url: 'https://www.who.int/news-room/fact-sheets/detail/food-additives' },
]
// Deliberately limited, auditable vocabulary. Unrecognized ingredients are never
// assigned an invented explanation or treated as proof of absence.
const entries = [
  ['sugar', /\b(?:sugar|sucrose|cane sugar|brown sugar)\b/i, 'sugar', 'Sugar is used to sweeten food.', false],
  ['glucose', /\b(?:glucose|dextrose)\b/i, 'sugar', 'Glucose, also called dextrose, is a simple sugar used for sweetness.', true],
  ['fructose', /\bfructose\b/i, 'sugar', 'Fructose is a simple sugar; when listed separately it is an ingredient.', true],
  ['syrup', /\b(?:corn syrup|glucose syrup|rice syrup|malt syrup|invert syrup|golden syrup|high fructose corn syrup)\b/i, 'sugar', 'This syrup is a sugar-containing sweetening ingredient.', true],
  ['honey', /\bhoney\b/i, 'sugar', 'Honey is a sugar-containing ingredient used for sweetness.', true],
  ['jaggery', /\b(?:jaggery|molasses)\b/i, 'sugar', 'A sugar-containing sweetening ingredient; a different name does not make it sugar-free.', true],
  ['sodium benzoate', /\b(?:sodium benzoate|(?:e|ins)\s*211)\b/i, 'preservative', 'A preservative used to limit microbial spoilage.', false],
  ['potassium sorbate', /\b(?:potassium sorbate|(?:e|ins)\s*202)\b/i, 'preservative', 'A preservative used to inhibit moulds and yeasts.', false],
  ['calcium propionate', /\b(?:calcium propionate|(?:e|ins)\s*282)\b/i, 'preservative', 'A preservative commonly used in baked products.', false],
  ['lecithin', /\b(?:lecithin|(?:e|ins)\s*322)\b/i, 'emulsifier', 'Helps ingredients such as oil and water mix.', false],
  ['citric acid', /\b(?:citric acid|(?:e|ins)\s*330)\b/i, 'acidity regulator', 'Adds acidity and can have several technological functions; its name alone does not prove a preservative role.', false],
  ['xanthan gum', /\b(?:xanthan gum|(?:e|ins)\s*415)\b/i, 'thickener', 'Helps thicken food and maintain texture.', false],
  ['sucralose', /\b(?:sucralose|(?:e|ins)\s*955)\b/i, 'sweetener', 'A non-sugar sweetener. It is not counted as sugar.', false],
  ['aspartame', /\b(?:aspartame|(?:e|ins)\s*951)\b/i, 'sweetener', 'A non-sugar sweetener. Its presence alone is not an honesty penalty.', false],
  ['maltodextrin', /\bmaltodextrin\b/i, 'carbohydrate', 'A starch-derived carbohydrate used for bulk or texture. It is not automatically classified as added sugar here.', false],
  ['salt', /\bsalt\b/i, 'seasoning', 'Adds salty flavour. This profile does not infer the amount from its position.', false],
  ['cocoa', /\bcocoa\b/i, 'food', 'A cocoa-derived ingredient used for chocolate flavour.', false],
  ['milk', /\b(?:milk|whey)\b/i, 'food', 'A dairy ingredient. Naturally occurring milk sugar is not proof that sugar was added.', false],
  ['oil', /\b(?:oil|butter)\b/i, 'food', 'A fat-containing ingredient used for cooking, flavour or texture.', false],
  ['flavour', /\b(?:flavou?r(?:ing)?s?)\b/i, 'flavouring', 'Adds or modifies flavour. A generic flavour declaration does not identify every substance.', false],
]
const grains = ['wheat', 'oat', 'rice', 'corn', 'maize', 'barley', 'rye', 'millet', 'sorghum', 'quinoa', 'buckwheat']
export function ingredientProfile(text) {
  const rawItems = text.replace(/^ingredients\s*:\s*/i, '').split(/[,;\n()[\]]/).map(s => s.trim()).filter(Boolean)
  const seen = new Set()
  const items = rawItems.map(raw => {
    // Syrups take precedence over their sugar-name components.
    const matches = entries.filter(entry => entry[1].test(raw))
    const match = matches.find(entry => entry[0] === 'syrup') || matches[0]
    const grain = grains.find(g => new RegExp('\\b' + g + 's?\\b', 'i').test(raw))
    const id = match?.[0] || (grain === 'maize' ? 'corn' : grain) || raw.toLowerCase()
    const category = match?.[2] || (grain ? 'grain' : 'unrecognized')
    const whole = /\bwhole(?:grain|meal)?\b/i.test(raw)
    const datasetEvidence = findIngredientInDataset(raw)
    const explanation = match?.[3] || (grain ? 'A grain ingredient. ' + (whole ? 'The wording identifies it as whole grain.' : 'This wording does not establish that it is whole grain.') : datasetEvidence ? `This name appears in ${datasetEvidence.productCount} product record(s) in the supplied India dataset. This is an identification match, not a health or safety assessment.` : 'Not yet covered by our ingredient reference. No health conclusion is assigned.')
    const duplicate = seen.has(id)
    seen.add(id)
    return { raw, id, category: match?.[2] || (grain ? 'grain' : datasetEvidence ? 'in dataset' : 'unrecognized'), grain: grain ? (grain === 'maize' ? 'corn' : grain) : null, whole, explanation, datasetEvidence, sugarAlias: Boolean(match?.[4]), duplicate }
  })
  const unique = items.filter(item => !item.duplicate)
  return {
    items, sugarCount: unique.filter(i => i.category === 'sugar').length,
    hiddenSugarCount: unique.filter(i => i.sugarAlias).length,
    additiveCount: unique.filter(i => ['preservative', 'emulsifier', 'acidity regulator', 'thickener', 'sweetener', 'flavouring'].includes(i.category)).length,
    datasetListedCount: unique.filter(i => i.datasetEvidence).length,
    unknownCount: unique.filter(i => i.category === 'unrecognized').length,
    sources,
    countNote: 'Counts are distinct recognized names, including subingredients, not grams or a complete chemical analysis. “Hidden sugars” means recognized sugar aliases, not evidence of concealment. No ingredient receives a health penalty.',
  }
}

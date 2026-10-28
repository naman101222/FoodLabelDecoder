import { ingredientProfile } from './ingredients.js'
export const claimOptions = [
  { id: 'no-added-sugar', label: 'No added sugar' },
  { id: 'no-sugar', label: 'No sugar / sugar-free' },
  { id: 'multigrain', label: 'Multigrain' },
  { id: 'no-preservatives', label: 'No preservatives' },
  { id: 'high-protein', label: 'High protein' },
]
export function evaluateLabel(ingredients, selectedClaims, confirmed = false, nutrients = [], basis = 'unknown') {
  const profile = ingredientProfile(ingredients)
  const selected = [...new Set(selectedClaims)]
  const checks = selected.map(id => {
    const option = claimOptions.find(c => c.id === id)
    const label = option?.label || id
    let status = 'unverifiable'
    let reason = 'The ingredient list alone cannot verify this claim.'
    let evidence = []
    let deduction = null
    if (!option) {
      status = 'not-scored'
      reason = 'There is no defined evidence rule for this custom marketing phrase, so it cannot fairly contribute to a numeric score.'
    } else if (!ingredients.trim()) reason = 'No ingredient list is available.'
    else if (!confirmed) reason = 'The ingredient list has not been confirmed complete and accurately read. OCR confidence alone is insufficient.'
    else if (id === 'no-added-sugar' || id === 'no-sugar') {
      evidence = profile.items.filter(i => i.category === 'sugar').map(i => i.raw)
      if (evidence.length) { status = 'contradicted'; reason = 'The ingredient list explicitly includes a recognized sugar or sugar-containing sweetening ingredient. Legal claim thresholds still depend on the product and jurisdiction.' }
      else reason = 'No recognized sugar ingredient was found, but this limited vocabulary cannot establish total sugar content or verify the legal claim.'
    } else if (id === 'multigrain') {
      const grainItems = profile.items.filter(i => i.grain)
      const distinct = new Set(grainItems.map(i => i.grain))
      evidence = grainItems.map(i => i.raw)
      if (distinct.size >= 2) { status = 'supported'; reason = 'At least two distinct grain types are listed. Multigrain does not mean whole grain or establish their proportions.' }
      else if (distinct.size === 1 && profile.unknownCount === 0) { status = 'contradicted'; reason = 'Only one grain type is present in the confirmed list under this prototype’s literal two-grain rule.' }
      else reason = 'Two distinct grains could not be established; unknown ingredients or a generic grain blend need clarification.'
    } else if (id === 'no-preservatives') {
      evidence = profile.items.filter(i => i.category === 'preservative').map(i => i.raw)
      if (evidence.length) { status = 'contradicted'; reason = 'A recognized preservative ingredient is explicitly listed.' }
      else reason = 'No recognized preservative was found, but ingredient names alone cannot establish every technological function or carry-over.'
    } else if (id === 'high-protein') {
      const protein = nutrients.find(item => item.key === 'protein' || /^protein$/i.test(item.name || ''))
      if (protein) {
        evidence = [(protein.qualifier === 'less-than' ? '< ' : '') + protein.value + ' ' + protein.unit + (basis === 'unknown' ? ' (label basis unknown)' : ' ' + basis.replace('per', 'per '))]
        reason = 'Protein was read from the nutrition panel, but a high-protein claim needs a defined jurisdiction-specific threshold and a reliable serving or energy basis. This prototype does not guess that threshold.'
      } else reason = 'No protein amount was confidently read. Ingredient names alone do not establish protein quantity or energy share.'
    }
    if (option && ingredients.trim() && confirmed) {
      const pointShare = 100 / selected.filter(selectedId => claimOptions.some(c => c.id === selectedId)).length
      deduction = status === 'supported' ? 0 : (status === 'contradicted' ? pointShare : pointShare / 2)
      deduction = Math.round(deduction * 100) / 100
    }
    return { id, claim: label, status, reason, evidence, deduction }
  })
  const scorableChecks = checks.filter(check => check.deduction !== null)
  const score = scorableChecks.length ? Math.round(100 - scorableChecks.reduce((sum, check) => sum + check.deduction, 0)) : null
  const scoreReason = score !== null ? null : selected.length === 0
    ? 'Select at least one printed claim with a defined checking rule.'
    : !ingredients.trim() || !confirmed
    ? 'No score yet: provide and confirm a complete, readable ingredient list before scoring claims.'
    : 'No score: none of the selected claims has a defined scoring rule yet.'
  return {
    ingredientProfile: profile,
    honesty: {
      score, scoreReason, checks, confirmed,
      version: 'prototype-1',
      method: 'Prototype rubric: recognized selected claims share 100 points equally. A supported claim loses 0 of its share, an unverifiable claim loses half its share, and a contradicted claim loses its full share. The 50% unverifiable weight is a design choice, not a validated food-label standard. Custom claims without explicit rules and reports lacking a confirmed complete ingredient list are not scored. Ingredients themselves never lose points.',
    },
  }
}

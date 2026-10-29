import { fssaiClaimRules, fssaiSources } from './fssaiRules.js'

export const claimOptions = fssaiClaimRules.map(rule => ({ id: rule.id, label: rule.label }))

function nutrientByKey(nutrients, key) {
  return nutrients.find(nutrient => nutrient.key === key) || null
}

function findSugarEvidence(ingredients) {
  const sugarPatterns = [
    /\b(?:sugar|sucrose|cane sugar|brown sugar)\b/i,
    /\b(?:glucose|dextrose)\b/i,
    /\bfructose\b/i,
    /\b(?:corn syrup|glucose syrup|rice syrup|malt syrup|invert syrup|golden syrup|high fructose corn syrup)\b/i,
    /\bhoney\b/i,
    /\b(?:jaggery|molasses)\b/i,
  ]
  return String(ingredients || '').replace(/^ingredients\s*:\s*/i, '')
    .split(/[,;\n()[\]]/).map(item => item.trim())
    .filter(item => item && sugarPatterns.some(pattern => pattern.test(item)))
}

export function evaluateLabel(ingredients, selectedClaims, confirmed = false, nutrients = [], basis = 'unknown') {
  const sugarEvidence = findSugarEvidence(ingredients)
  const selected = [...new Set(selectedClaims)]
  const checks = selected.map(id => {
    const rule = fssaiClaimRules.find(candidate => candidate.id === id)
    if (!rule) return { id, claim: id, status: 'no-rule-recorded', evidence: [], reason: 'No FSSAI evidence rule has been recorded for this phrase. It is shown as a claim, but no verdict is made.', source: null, requirements: [] }
    const nutrientKey = rule.id === 'sugar-free' ? 'total-sugars'
      : rule.id === 'high-protein' ? 'protein'
        : rule.id === 'low-fat' ? 'total-fat'
          : rule.id === 'trans-fat-free' ? 'trans-fat' : null
    const nutrient = nutrientKey ? nutrientByKey(nutrients, nutrientKey) : null
    const result = rule.evaluate({ complete: confirmed, basis, nutrient, sugarEvidence })
    const evidence = nutrient ? [`${rule.label}: ${nutrient.value} ${nutrient.unit}`] : rule.id === 'no-added-sugar' ? sugarEvidence : []
    return { id: rule.id, claim: rule.label, ...result, evidence, requirements: rule.requirements, source: fssaiSources.find(source => source.id === rule.sourceId), citation: rule.citation }
  })
  return {
    honesty: {
      checks, confirmed, version: 'fssai-records-1', sources: fssaiSources,
      method: 'Each selected claim is checked against a versioned FSSAI rule record and the text read from the package. A result is supported only when every requirement available to this prototype is satisfied; otherwise it is contradicted by the read label or marked cannot verify. This is an evidence aid, not an enforcement or legal-compliance decision.',
    },
  }
}

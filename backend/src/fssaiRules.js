// These records are a machine-readable implementation aid, not legal advice.
// Every verdict cites the FSSAI source and is withheld when its required label
// evidence is missing.
export const fssaiSources = [
  {
    id: 'claims-2018-v4',
    title: 'Food Safety and Standards (Advertising and Claims) Regulations, 2018 — Version IV (14 December 2022)',
    url: 'https://www.fssai.gov.in/upload/uploadfiles/files/Compendium_Advertising_Claims_Regulations_14_12_2022.pdf',
    note: 'FSSAI states that a compendium is a ready reference; original notifications and amendments prevail.',
  },
  {
    id: 'labelling-2020',
    title: 'Food Safety and Standards (Labelling and Display) Regulations, 2020',
    url: 'https://www.fssai.gov.in/upload/notifications/2020/12/5fd87c6a0f6adGazette_Notification_Labelling_Display_14_12_2020.pdf',
  },
]

export const fssaiClaimRules = [
  {
    id: 'sugar-free',
    aliases: ['no-sugar', 'sugar-free', 'zero-sugar'],
    label: 'No sugar / sugar-free',
    sourceId: 'claims-2018-v4',
    citation: 'Schedule I: Sugar — Free',
    requirements: ['Nutrition basis must be per 100 g or per 100 ml.', 'Total sugars must be no more than 0.5 g per 100 g or 100 ml.'],
    evaluate: ({ nutrient, basis }) => {
      if (!['per100g', 'per100ml'].includes(basis)) return unresolved('The panel must state values per 100 g or per 100 ml to check this threshold.')
      if (!nutrient) return unresolved('Total sugars were not confidently read from the nutrition panel.')
      return nutrient.value <= 0.5
        ? supported(`Total sugars read as ${nutrient.value} g per ${basis === 'per100g' ? '100 g' : '100 ml'}, within the 0.5 g limit.`)
        : contradicted(`Total sugars read as ${nutrient.value} g per ${basis === 'per100g' ? '100 g' : '100 ml'}, above the 0.5 g limit.`)
    },
  },
  {
    id: 'no-added-sugar',
    aliases: ['no-added-sugar', 'without-added-sugar'],
    label: 'No added sugar',
    sourceId: 'claims-2018-v4',
    citation: 'Regulation 6(1): Non-addition of sugars',
    requirements: ['Complete ingredient list.', 'No added mono- or disaccharides, or another food used for sweetening.', 'When sugars occur naturally, the label must carry the required naturally occurring sugars indication.'],
    evaluate: ({ complete, sugarEvidence }) => {
      if (!complete) return unresolved('The complete ingredient list has not been confirmed.')
      if (sugarEvidence.length) return contradicted(`Recognized sweetening ingredients are listed: ${sugarEvidence.join(', ')}.`)
      return unresolved('No recognized sweetening ingredient was found, but a full regulatory check also needs confirmation of all sweetening ingredients and any required naturally occurring sugars statement.')
    },
  },
  {
    id: 'high-protein',
    aliases: ['high-protein', 'rich-in-protein'],
    label: 'High protein',
    sourceId: 'claims-2018-v4',
    citation: 'Schedule I: Protein — Rich / High',
    requirements: ['Protein amount.', 'Applicable RDA and the stated basis.', 'At least 20% of RDA per 100 g for solids, 10% per 100 ml for liquids, or 10% per 100 kcal.'],
    evaluate: ({ nutrient, basis }) => {
      if (!nutrient) return unresolved('Protein was not confidently read from the nutrition panel.')
      if (!['per100g', 'per100ml'].includes(basis)) return unresolved(`Protein was read as ${nutrient.value} g, but the basis and applicable RDA needed for this rule are incomplete.`)
      return unresolved(`Protein was read as ${nutrient.value} g per ${basis === 'per100g' ? '100 g' : '100 ml'}. The claim needs the applicable RDA or declared % RDA before it can be verified.`)
    },
  },
  {
    id: 'low-fat',
    aliases: ['low-fat'],
    label: 'Low fat',
    sourceId: 'claims-2018-v4',
    citation: 'Schedule I: Fat — Low',
    requirements: ['Nutrition basis must be per 100 g or per 100 ml.', 'Fat must be no more than 3 g per 100 g for solids or 1.5 g per 100 ml for liquids.'],
    evaluate: ({ nutrient, basis }) => thresholdRule(nutrient, basis, 3, 1.5, 'Total fat'),
  },
  {
    id: 'trans-fat-free',
    aliases: ['trans-fat-free'],
    label: 'Trans fat free',
    sourceId: 'claims-2018-v4',
    citation: 'Schedule I: Trans fat — Free',
    requirements: ['Nutrition basis must be per 100 g or per 100 ml.', 'Trans fat must be less than 0.2 g per 100 g or 100 ml.'],
    evaluate: ({ nutrient, basis }) => {
      if (!['per100g', 'per100ml'].includes(basis)) return unresolved('The panel must state values per 100 g or per 100 ml to check this threshold.')
      if (!nutrient) return unresolved('Trans fat was not confidently read from the nutrition panel.')
      return nutrient.value < 0.2 ? supported(`Trans fat read as ${nutrient.value} g, below 0.2 g per ${basis === 'per100g' ? '100 g' : '100 ml'}.`) : contradicted(`Trans fat read as ${nutrient.value} g, which does not meet the below-0.2 g condition.`)
    },
  },
]

function thresholdRule(nutrient, basis, solidsLimit, liquidsLimit, label) {
  if (!['per100g', 'per100ml'].includes(basis)) return unresolved('The panel must state values per 100 g or per 100 ml to check this threshold.')
  if (!nutrient) return unresolved(`${label} was not confidently read from the nutrition panel.`)
  const limit = basis === 'per100g' ? solidsLimit : liquidsLimit
  return nutrient.value <= limit ? supported(`${label} read as ${nutrient.value} g, within the ${limit} g limit.`) : contradicted(`${label} read as ${nutrient.value} g, above the ${limit} g limit.`)
}
function supported(reason) { return { status: 'supported-by-read-label', reason } }
function contradicted(reason) { return { status: 'contradicted-by-read-label', reason } }
function unresolved(reason) { return { status: 'cannot-verify', reason } }

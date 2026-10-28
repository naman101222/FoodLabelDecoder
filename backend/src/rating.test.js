import test from 'node:test'
import assert from 'node:assert/strict'
import { rateNutrients } from './rating.js'

const nutrient = (key, value, unit = 'g') => ({ key, value, unit, readability: 'clear', qualifier: 'exact' })
const base = { kind: 'solid', basis: 'perServing', servingGrams: 50, basisReadable: true, nutrients: [
  nutrient('fat', 7), nutrient('saturated_fat', 2.5), nutrient('sugars', 15), nutrient('sodium', 170, 'mg'),
] }
test('normalizes the supplied pastry label without mixing daily percentages', () => {
  const result = rateNutrients(base)
  assert.equal(result.status, 'complete')
  assert.deepEqual(result.items.map(n => [n.value, n.level]), [[14, 'medium'], [5, 'medium'], [30, 'high'], [0.85, 'medium']])
})
test('withholds ratings for uncertain basis, liquids and missing weight', () => {
  for (const change of [{ basisReadable: false }, { kind: 'drink' }, { servingGrams: null }, { issues: ['conflicting readings'] }]) {
    assert.equal(rateNutrients({ ...base, ...change }).status, 'unavailable')
  }
})
test('does not treat missing or uncertain values as zero', () => {
  const result = rateNutrients({ ...base, nutrients: [{ ...nutrient('sugars', 0), readability: 'uncertain' }] })
  assert.equal(result.status, 'partial')
  assert.ok(result.items.every(item => item.level === 'unknown'))
})

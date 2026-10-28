import test from 'node:test'
import assert from 'node:assert/strict'
import { analyze } from './analyze.js'
import { evaluateLabel } from './honesty.js'

test('reads units in headings and values on the next line', () => {
  const report = analyze('Protein (g) 12\nSodium\n120 mg')
  assert.deepEqual(report.nutrients.map(n => n.value), [12, 120])
})

test('selected label claims use the ingredient profile and leave ingredients unpenalized', () => {
  const result = evaluateLabel('whole wheat, rice, sugar, cocoa', ['no-added-sugar', 'multigrain'], true)
  assert.equal(result.ingredientProfile.sugarCount, 1)
  assert.equal(result.honesty.checks[0].status, 'contradicted')
  assert.equal(result.honesty.checks[1].status, 'supported')
  assert.equal(result.honesty.score, 50)
})

test('accepts OCR spacing, decimal commas, zero, and daily-value percentages', () => {
  const result = analyze('Product: Cereal\nServing size 30 g\nSugar 11,2 g\nSodium: 0 mg 0%\nEnergy 118 kcal\nDietary fiber .5g (2%)')
  assert.equal(result.name, 'Cereal')
  assert.equal(result.serving, '30 g')
  assert.deepEqual(result.nutrients.map(n => [n.value, n.unit]), [[11.2, 'g'], [0, 'mg'], [118, 'kcal'], [0.5, 'g']])
})

test('collects multiline ingredients and stops at another section', () => {
  const result = analyze('Ingredients:\nOats, cocoa,\nsugar, salt.\nContains: milk\nProtein 3g')
  assert.equal(result.ingredients, 'Oats, cocoa, sugar, salt.')
  assert.equal(result.nutrients[0].value, 3)
})

test('does not guess missing units, malformed OCR, ranges or multiple columns', () => {
  for (const line of ['Sugar 12', 'Sugar 1O g', 'Sugar <0.5g', 'Sugar 5g 10g', 'Sugar -5g', 'Sodium 5 kcal', 'Energy 5g']) {
    const result = analyze(line)
    assert.equal(result.nutrients.length, 0, line)
    assert.ok(result.notes.some(note => note.includes(line)), line)
  }
})

test('missing fields stay null and unknown text does not produce nutrients', () => {
  const result = analyze('Unrecognized text')
  assert.equal(result.ingredients, null)
  assert.equal(result.serving, null)
  assert.deepEqual(result.nutrients, [])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { lookupProduct } from './products.js'

test('barcode lookup preserves zero and missing values and attributes the source', async () => {
  const result = await lookupProduct('12345678', async url => {
    assert.equal(url.hostname, 'world.openfoodfacts.org')
    return { ok: true, json: async () => ({ product: { product_name: 'Example', nutriments: { sugars_100g: 0, salt_100g: null }, nutriscore_grade: 'b' } }) }
  })
  assert.equal(result.nutrients.length, 1)
  assert.equal(result.nutrients[0].value, 0)
  assert.equal(result.databaseGrade, 'B')
  assert.equal(result.source, 'Open Food Facts')
})
test('invalid barcode never makes a network request', async () => {
  await assert.rejects(lookupProduct('../secret', () => assert.fail()), error => error.status === 400)
})
test('missing database product returns an actionable error', async () => {
  await assert.rejects(lookupProduct('12345678', async () => ({ status: 404 })), error => error.status === 404)
})

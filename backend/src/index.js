import cors from 'cors'
import express from 'express'
import { analyze } from './analyze.js'
import { evaluateLabel } from './honesty.js'
const app = express()
const port = Number(process.env.PORT ?? 3001)
app.use(cors())
app.use(express.json({ limit: '64kb' }))
app.post('/api/analyze', (request, response) => {
  const label = request.body?.label
  if (typeof label !== 'string' || !label.trim() || label.length > 24000) {
    response.status(400).json({ error: 'Label text must contain between 1 and 24,000 characters.' })
    return
  }
  const frontText = request.body?.frontText ?? ''
  if (typeof frontText !== 'string' || frontText.length > 10000) {
    response.status(400).json({ error: 'Front-of-pack text must be at most 10,000 characters.' })
    return
  }
  const ocrConfidence = request.body?.ocrConfidence ?? null
  if (ocrConfidence !== null && (typeof ocrConfidence !== 'number' || ocrConfidence < 0 || ocrConfidence > 100)) {
    response.status(400).json({ error: 'OCR confidence must be a number from 0 to 100.' })
    return
  }
  const report = analyze(label, frontText)
  const selectedClaims = request.body?.selectedClaims ?? []
  if (!Array.isArray(selectedClaims) || selectedClaims.length > 12) {
    response.status(400).json({ error: 'Choose up to 12 package claims.' })
    return
  }
  const ingredientListComplete = request.body?.ingredientListComplete === true
  const result = evaluateLabel(report.ingredients || '', selectedClaims, ingredientListComplete, report.nutrients, report.basis)
  response.json({ ...report, ...result, frontText: frontText.trim(), ocrConfidence })
})
app.post('/api/evaluate', (request, response) => {
  const { ingredients, ingredientListComplete, selectedClaims, nutrients } = request.body ?? {}
  if (typeof ingredients !== 'string' || ingredients.length > 10000 || !Array.isArray(selectedClaims) || selectedClaims.length > 12 || !Array.isArray(nutrients)) {
    response.status(400).json({ error: 'Provide an ingredient list, up to 12 selected claims, and nutrition facts.' })
    return
  }
  response.json(evaluateLabel(ingredients, selectedClaims, ingredientListComplete === true, nutrients, request.body?.basis))
})
app.get('/health', (_request, response) => response.json({ status: 'ok', service: 'food-label-decoder-api' }))
app.listen(port, () => console.log(`FoodLabel Decoder API listening on port ${port}`))

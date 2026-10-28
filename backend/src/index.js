import cors from 'cors'
import express from 'express'
import { analyze } from './analyze.js'
import { evaluateLabel } from './honesty.js'
import { findDatasetMatches } from './validationDataset.js'
import { buildNutritionView } from './nutritionView.js'
import { geminiOcrConfigured, geminiOcrModel, readLabelImage } from './geminiOcr.js'
const app = express()
const port = Number(process.env.PORT ?? 3001)
app.use(cors())
app.get('/api/ocr/status', (_request, response) => response.json({
  configured: geminiOcrConfigured(),
  provider: geminiOcrConfigured() ? 'Google Gemini' : 'Tesseract.js (local fallback)',
  model: geminiOcrConfigured() ? geminiOcrModel() : null,
}))
app.post('/api/ocr', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '12mb' }), async (request, response) => {
  const mimeType = request.headers['content-type']
  const panel = request.headers['x-label-panel']
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    response.status(415).json({ error: 'Use a JPG, PNG, or WebP image.' })
    return
  }
  if (!['nutrition', 'ingredients', 'front'].includes(panel)) {
    response.status(400).json({ error: 'Choose a nutrition, ingredients, or front-of-pack photo.' })
    return
  }
  if (!geminiOcrConfigured()) {
    response.status(503).json({ error: 'Cloud OCR is not configured.' })
    return
  }
  try {
    const result = await readLabelImage(request.body, mimeType, panel)
    response.json(result)
  } catch (error) {
    response.status(502).json({ error: error.message || 'Cloud OCR could not read this image.' })
  }
})
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
  const nutritionView = buildNutritionView(report)
  const selectedClaims = request.body?.selectedClaims ?? report.suggestedClaims
  if (!Array.isArray(selectedClaims) || selectedClaims.length > 12) {
    response.status(400).json({ error: 'Choose up to 12 package claims.' })
    return
  }
  const ingredientListComplete = request.body?.ingredientListComplete === true
  const result = evaluateLabel(report.ingredients || '', selectedClaims, ingredientListComplete, report.nutrients, report.basis)
  const validation = findDatasetMatches({ label, frontText, ingredients: report.ingredients || '' })
  const ocrProvider = request.body?.ocrProvider
  response.json({ ...report, ...result, nutritionView, validation, frontText: frontText.trim(), ocrConfidence, ocrProvider: typeof ocrProvider === 'string' ? ocrProvider.slice(0, 80) : null })
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

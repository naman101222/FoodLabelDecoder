import { useEffect, useRef, useState } from 'react'
import { recognizePanel } from './ocr.js'

const panels = [
  ['nutrition', 'Nutrition facts', 'Upload a close photo of the nutrition table.'],
  ['ingredients', 'Ingredients', 'Upload the full ingredients panel, including sub-ingredients.'],
  ['front', 'Front of pack', 'Optional: capture claims such as “no added sugar” or “multigrain”.'],
]

export default function PhotoInput({ onDecode, onReset, disabled }) {
  const [files, setFiles] = useState({})
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [reading, setReading] = useState(null)
  const workerRef = useRef(null)
  const generation = useRef(0)
  useEffect(() => () => { generation.current++; workerRef.current?.terminate() }, [])

  function choose(event, panel) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
      setError('Choose a JPG, PNG, or WebP image smaller than 12 MB.')
      return
    }
    setFiles(previous => ({ ...previous, [panel]: file }))
    setReading(null)
    setError('')
    onReset()
  }

  async function readAndAnalyze() {
    const run = ++generation.current
    let worker
    setBusy(true)
    setError('')
    onReset()
    try {
      let cloudAvailable = false
      try {
        const response = await fetch('/api/ocr/status', { signal: AbortSignal.timeout(5000) })
        cloudAvailable = response.ok && (await response.json()).configured === true
      } catch { /* A running local OCR path is still available if the API is offline. */ }
      const next = {}
      const providers = new Set()
      for (const [panel, title] of panels) {
        if (!files[panel]) continue
        let result
        if (cloudAvailable) {
          setStatus(`Sending the ${title.toLowerCase()} photo to Gemini for visual reading…`)
          try {
            const response = await fetch('/api/ocr', {
              method: 'POST',
              headers: { 'Content-Type': files[panel].type, 'X-Label-Panel': panel },
              body: files[panel],
              signal: AbortSignal.timeout(55000),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Cloud OCR failed.')
            result = { text: data.text, uncertainSegments: data.uncertainSegments || [], provider: data.provider }
          } catch (cloudError) {
            setStatus(`Gemini could not read this photo (${cloudError.message}). Trying local Tesseract OCR…`)
            cloudAvailable = false
          }
        }
        if (!result) {
          if (!worker) {
            setStatus('Loading the local text reader…')
            const { createWorker } = await import('tesseract.js')
            worker = await createWorker('eng', 1)
            if (run !== generation.current) return
            workerRef.current = worker
          }
          setStatus(`Reading ${title.toLowerCase()} photo locally (trying rotations and contrast)…`)
          const localResult = await recognizePanel(worker, files[panel], {
            rotations: panel === 'front' ? [0, 90, 270] : [0, 90, 270, 180],
          })
          result = { ...localResult, provider: 'Tesseract.js (local)' }
        }
        if (run !== generation.current) return
        next[panel] = result.text
        next[`${panel}Confidence`] = result.confidence
        next[`${panel}Uncertain`] = result.uncertainSegments || []
        next[`${panel}Provider`] = result.provider
        providers.add(result.provider)
      }
      next.ocrProvider = [...providers].join(' + ')
      if (!next.nutrition?.trim()) throw new Error('The nutrition panel could not be read. Try a closer, straighter photo with less glare.')
      setReading(next)
      setStatus('Analyzing the extracted label text…')
      await onDecode(next)
      const uncertain = [next.nutritionUncertain, next.ingredientsUncertain, next.frontUncertain].some(parts => parts?.length)
      const low = [next.nutritionConfidence, next.ingredientsConfidence, next.frontConfidence].some(value => value !== undefined && value < 55)
      setStatus(`${next.ocrProvider} reading complete. ${uncertain || low ? 'Review unclear text before relying on the report.' : 'Review the transcription against the package.'}`)
    } catch (err) {
      if (run === generation.current) setError(err.message || 'Could not read the photos. Please try again.')
    } finally {
      if (worker) await worker.terminate().catch(() => {})
      if (run === generation.current) { workerRef.current = null; setBusy(false) }
    }
  }

  async function analyzeCorrected() {
    if (!reading?.nutrition?.trim()) return
    setBusy(true)
    setError('')
    try {
      await onDecode(reading)
      setStatus('Updated report from your corrected text.')
    } catch (err) { setError(err.message || 'Could not analyze the corrected text.') }
    finally { setBusy(false) }
  }

  function cancel() {
    generation.current++
    workerRef.current?.terminate().catch(() => {})
    workerRef.current = null
    setBusy(false)
    setStatus('Scan cancelled.')
  }

  return <section aria-label="Decode label photos">
    <h2>Scan a label</h2>
    <p className="format-help">Add the nutrition panel and full ingredients panel; the front photo helps check printed claims.</p>
    {panels.map(([panel, title, help]) => <div className="upload-slot" key={panel}>
      <label htmlFor={panel}>{title}{panel === 'front' ? ' (optional)' : ' *'}</label>
      <p className="format-help">{help}</p>
      <input id={panel} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy || disabled} onChange={event => choose(event, panel)} />
      {files[panel] && <p className="file-name">Selected: {files[panel].name}</p>}
    </div>)}
    <p className="privacy-note">When Gemini is configured, selected photos are sent to Google for reading; Gemini free-tier content may be used to improve Google products. Otherwise, Tesseract reads them on this device. The analysis API receives the extracted text.</p>
    <div className="actions">
      <button type="button" className="submit-button" disabled={!files.nutrition || !files.ingredients || busy || disabled} onClick={readAndAnalyze}>{busy ? 'Reading photos…' : 'Decode this label'}</button>
      {busy && <button type="button" className="sample-button" onClick={cancel}>Cancel</button>}
    </div>
    <p role="status" className="format-help">{status}</p>
    {error && <p role="alert" className="error">{error}</p>}
    {reading && <details open={[
      reading.nutritionConfidence,
      reading.ingredientsConfidence,
      reading.frontConfidence,
    ].some(value => value !== undefined && value < 55) || [reading.nutritionUncertain, reading.ingredientsUncertain, reading.frontUncertain].some(parts => parts?.length)}>
      <summary>Review or correct the text read from each photo</summary>
      {panels.map(([panel, title]) => reading[panel] !== undefined && <div className="review-field" key={panel}>
        <label htmlFor={`read-${panel}`}>{title} text{reading[panel + 'Confidence'] !== undefined ? ` · Tesseract estimate ${Math.round(reading[panel + 'Confidence'])}%` : ` · ${reading[panel + 'Provider'] || reading.ocrProvider || 'visual reading'}`}</label>
        {reading[panel + 'Uncertain']?.length > 0 && <p className="format-help">Gemini marked these parts as unclear: {reading[panel + 'Uncertain'].join(' · ')}</p>}
        <textarea id={`read-${panel}`} className="label-input" rows={panel === 'ingredients' ? 7 : 5} value={reading[panel]} onChange={event => { setReading({ ...reading, [panel]: event.target.value }); onReset() }} />
      </div>)}
      <button type="button" className="submit-button" disabled={busy || disabled || !reading.nutrition?.trim()} onClick={analyzeCorrected}>Analyze corrected text</button>
    </details>}
  </section>
}

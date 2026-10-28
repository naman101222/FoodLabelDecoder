import { useState } from 'react'
import PhotoInput from './PhotoInput.jsx'
import IngredientProfile from './IngredientProfile.jsx'
import HonestyChecker from './HonestyChecker.jsx'


export default function App() {
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function decode(reading) {
    setBusy(true)
    setError('')
    setReport(null)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: `${reading.nutrition || ''}\nIngredients: ${reading.ingredients || ''}`,
          frontText: reading.front || '',
          ocrConfidence: reading.nutritionConfidence ?? null,
        }),
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error('Analysis could not be completed. Check your input and try again.')
      setReport(await response.json())
    } catch {
      setError('Could not analyze the label. Make sure the backend is running, then try again.')
    } finally { setBusy(false) }
  }
  return <main className="app">
    <nav className="nav">
      <a href="#" className="brand">FoodLabel <span className="brand-accent">Decoder</span></a>
      <span className="badge">Local photo recognition</span>
    </nav>
    <div className="container">
      <p className="eyebrow">Know what is in your food</p>
      <h1 className="hero-title">A clearer look at your food label.</h1>
      <p className="intro">Add clear photos of the nutrition table, ingredients, and front of pack. We read the text on your device and show what the package evidence supports.</p>
      <div className="workspace">
        <div className="input-panel"><PhotoInput disabled={busy} onReset={() => setReport(null)} onDecode={decode} /></div>
        <section aria-live="polite" aria-busy={busy} className="report-panel">
          <p className="report-label">Label report</p>
          <h2 className="report-title">{report?.name || 'Ready when you are'}</h2>
          {report ? <>
            <IngredientProfile profile={report.ingredientProfile} />
            <HonestyChecker report={report} onResult={result => setReport(current => ({ ...current, ingredientProfile: result.ingredientProfile, honesty: result.honesty }))} />
            {report.basisLabel && <p className="serving">{report.basisLabel}</p>}
            <p className="serving">Nutrition basis: {report.basis === 'per100g' ? 'per 100 g' : report.basis === 'per100ml' ? 'per 100 ml' : report.basis === 'perServing' ? 'per serving' : 'not identified; values are not normalized'}{report.ocrConfidence !== null && report.ocrConfidence !== undefined ? ` · OCR confidence ${Math.round(report.ocrConfidence)}% (estimate)` : ''}</p>
            {!report.nutrients.length && <p className="error-box">We could not reliably read nutrition values. Check the extracted text or retake a tightly cropped photo.</p>}
            {report.issues?.length > 0 && <><h3 className="ingredients-title">Rows to check</h3><ul className="notes">{report.issues.map((issue, index) => <li key={index}>{issue.reason} “{issue.line}”</li>)}</ul></>}
            <p className="serving">Serving size: {report.serving || 'Could not identify'}</p>
            <dl className="nutrients">{report.nutrients.map((nutrient, index) => <div key={index} className="nutrient-row"><dt className="nutrient-name">{nutrient.name}</dt><dd className="nutrient-value">{nutrient.qualifier === 'less-than' ? '< ' : ''}{nutrient.value} {nutrient.unit}{nutrient.confidence === 'estimated-unit' ? ' (unit inferred)' : ''}</dd></div>)}</dl>
            <h3 className="ingredients-title">Ingredients read from the package</h3>
            <p className="ingredients">{report.ingredients || 'Could not identify — check the text or photo.'}</p>
            <ul className="notes">{report.notes.map(note => <li key={note}>{note}</li>)}</ul>
          </> : <p className="empty-report">{busy ? 'Reading the label…' : 'Upload a nutrition photo and a complete ingredients photo to get started.'}</p>}
        </section>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  </main>
}

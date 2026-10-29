import { useState } from 'react'
import PhotoInput from './PhotoInput.jsx'
import HonestyChecker from './HonestyChecker.jsx'
import RealityCheck, { NutritionTable } from './RealityCheck.jsx'
import { buildDisplayView } from './nutritionDisplay.js'

export default function App() {
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const displayView = report ? buildDisplayView(report) : null

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
          nutritionData: reading.nutritionData || null,
          ocrConfidence: reading.nutritionConfidence ?? null,
          ocrProvider: reading.ocrProvider || null,
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
      <span className="badge">Gemini vision · local fallback</span>
    </nav>
    <div className="container">
      <p className="eyebrow">A clearer look inside the pack</p>
      <h1 className="hero-title">See the whole food label at a glance.</h1>
      <p className="intro">Scan the package to see what one serving contains, what the whole pack adds up to, and how its front-of-pack claims compare with the label.</p>
      <div className="workspace">
        <div className="input-panel"><PhotoInput disabled={busy} onReset={() => setReport(null)} onDecode={decode} /></div>
        <section aria-live="polite" aria-busy={busy} className="report-panel">
          <p className="report-label">Your food reality check</p>
          <h2 className="report-title">{report?.name === 'Your food label' ? 'Your scan results' : report?.name || 'Ready when you are'}</h2>
          {report ? <>
            <RealityCheck report={report} view={displayView} />
            <HonestyChecker key={`${report.frontText}-${report.ingredients}`} report={report} onResult={result => setReport(current => ({ ...current, honesty: result.honesty }))} />
            <details className="evidence-details">
              <summary>Check the text read from your photos</summary>
              <p className="serving">Nutrition basis: {report.basis === 'per100g' ? 'per 100 g' : report.basis === 'per100ml' ? 'per 100 ml' : report.basis === 'perServing' ? 'per serving' : 'not identified; values are not normalized'}{report.ocrConfidence !== null && report.ocrConfidence !== undefined ? ` · OCR confidence ${Math.round(report.ocrConfidence)}% (estimate)` : ''}</p>
              <p className="serving">Serving size: {report.serving || 'Could not identify'}</p>
              {!report.nutrients.length && <p className="error-box">Nutrition values could not be read reliably. Any claim that depends on them will be marked “Cannot verify.”</p>}
              {report.issues?.length > 0 && <><h3 className="ingredients-title">Readings to check</h3><ul className="notes">{report.issues.map((issue, index) => <li key={index}>{issue.reason} “{issue.line}”</li>)}</ul></>}
              {report.nutrients.length > 0 && <dl className="nutrients">{report.nutrients.map((nutrient, index) => <div key={index} className="nutrient-row"><dt className="nutrient-name">{nutrient.name}</dt><dd className="nutrient-value">{nutrient.qualifier === 'less-than' ? '< ' : ''}{nutrient.value} {nutrient.unit}{nutrient.confidence === 'estimated-unit' ? ' (unit inferred)' : ''}</dd></div>)}</dl>}
              <h3 className="ingredients-title">Full ingredients text read</h3>
              <p className="ingredients">{report.ingredients || 'Could not identify ingredients from the photo.'}</p>
              <ul className="notes">{report.notes.map(note => <li key={note}>{note}</li>)}</ul>
            </details>
            <NutritionTable view={displayView} />
          </> : <p className="empty-report">{busy ? 'Reading the label…' : 'Add clear photos of the package front, nutrition panel, and full ingredients list to get your reality check.'}</p>}
        </section>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  </main>
}

import { useState } from 'react'

const claims = [
  ['no-added-sugar', 'No added sugar'],
  ['sugar-free', 'Sugar-free'],
  ['high-protein', 'High protein'],
  ['low-fat', 'Low fat'],
  ['trans-fat-free', 'Trans fat free'],
]

const statusLabels = {
  'supported-by-read-label': 'Supported by label',
  'contradicted-by-read-label': 'Contradicted by label',
  'cannot-verify': 'Cannot verify',
  'no-rule-recorded': 'No rule recorded',
}

export default function HonestyChecker({ report, onResult }) {
  const [selected, setSelected] = useState(() => report.suggestedClaims || [])
  const [custom, setCustom] = useState('')
  const [complete, setComplete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function toggle(value) {
    setSelected(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])
    setError('')
  }

  async function check(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: report.ingredients || '',
          ingredientListComplete: complete,
          selectedClaims: [...selected, ...custom.split(',').map(value => value.trim()).filter(Boolean)],
          nutrients: report.nutrients || [],
          basis: report.basis || 'unknown',
        }),
        signal: AbortSignal.timeout(15000),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Claims could not be checked.')
      onResult(result)
    } catch (err) { setError(err.message || 'Could not check these claims.') }
    finally { setBusy(false) }
  }

  return <section className="honesty-checker">
    <h3>Check the package claims</h3>
    <p className="format-help">We compare claims we can recognize with the ingredient and nutrition evidence. Confirm the detected phrases or choose the claims you see on the pack.</p>
    {report.frontText && <div className="detected-claims"><strong>Text read from the front</strong><p>{report.frontText}</p><span>Confirm which phrases are claims below; OCR text alone is not treated as proof.</span></div>}
    <form onSubmit={check}>
      <fieldset className="claim-options">
        <legend>Claims to check</legend>
        {claims.map(([key, label]) => <label key={key}>
          <input type="checkbox" checked={selected.includes(key)} disabled={busy} onChange={() => toggle(key)} />
          {label}
        </label>)}
      </fieldset>
      <label htmlFor="custom-claims">Other printed claims</label>
      <input id="custom-claims" className="label-input" value={custom} disabled={busy} onChange={event => setCustom(event.target.value)} placeholder="Separate claims with commas" />
      <label className="complete-check"><input type="checkbox" checked={complete} disabled={busy} onChange={event => setComplete(event.target.checked)} /> I confirmed the complete ingredient list was read</label>
      <button className="submit-button" disabled={busy || (!selected.length && !custom.trim())}>{busy ? 'Checking…' : 'Check claims'}</button>
      {error && <p role="alert" className="error">{error}</p>}
    </form>
    {report.honesty && <div className="honesty-result" aria-live="polite">
      {report.honesty.checks.map((claim, index) => <article className={`claim-card claim-${claim.status}`} key={claim.id + index}>
        <div className="claim-heading"><h4>{claim.claim}</h4><span className="claim-status">{statusLabels[claim.status] || claim.status}</span></div>
        <p>{claim.reason}</p>
        {claim.evidence.length > 0 && <p className="claim-evidence"><strong>Evidence found:</strong> {claim.evidence.join(', ')}</p>}
        {claim.requirements.length > 0 && <details className="rule-details"><summary>What this check requires</summary><ul>{claim.requirements.map(item => <li key={item}>{item}</li>)}</ul></details>}
        {claim.source && <p className="claim-source"><a href={claim.source.url} target="_blank" rel="noreferrer">{claim.source.title}</a> · {claim.citation}</p>}
      </article>)}
      {!report.honesty.checks.length && <p className="no-claims">Select a printed claim above to see whether the label supports it.</p>}
      <p className="format-help method-note">Checks are evidence-based rule comparisons, not an overall health score. “Cannot verify” means required label evidence was missing or unclear.</p>
    </div>}
  </section>
}

import { useState } from 'react'

const claims = [
  ['no-added-sugar', 'No added sugar'],
  ['no-sugar', 'No sugar / sugar-free'],
  ['multigrain', 'Multigrain'],
  ['no-preservatives', 'No preservatives'],
  ['high-protein', 'High protein'],
]

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
    } catch (error) { setError(error.message || 'Could not check these claims.') }
    finally { setBusy(false) }
  }
  return <section className="honesty-checker">
    <h3>Label honesty score</h3>
    <p className="format-help">Check the claims actually printed on this pack. Front-photo suggestions are preselected for you to confirm. Deductions and evidence are shown below.</p>
    {report.frontText && <p className="format-help"><strong>Front photo text detected:</strong> {report.frontText} Select the claims you want checked below; OCR suggestions are not treated as proof.</p>}
    <form onSubmit={check}>
      <div className="claim-options">{claims.map(([key, label]) => <label key={key}>
        <input type="checkbox" checked={selected.includes(key)} disabled={busy} onChange={() => toggle(key)} />
        {label}
      </label>)}</div>
      <label htmlFor="custom-claims">Other claims, separated by commas</label>
      <input id="custom-claims" className="label-input" value={custom} disabled={busy} onChange={event => setCustom(event.target.value)} placeholder="e.g. natural, immunity support" />
      <label className="complete-check"><input type="checkbox" checked={complete} disabled={busy} onChange={event => setComplete(event.target.checked)} /> I entered the complete ingredient list as printed</label>
      <button className="submit-button" disabled={busy || (!selected.length && !custom.trim())}>{busy ? 'Checking claims…' : 'Check selected claims'}</button>
      {error && <p role="alert" className="error">{error}</p>}
    </form>
    {report.honesty && <div className="honesty-result" aria-live="polite">
      {report.honesty.score !== null && <><p className="honesty-score">{report.honesty.score}<span>/100</span></p><p>Evidence score based on selected claims.</p></>}
      {report.honesty.score === null && <p className="error-box">{report.honesty.scoreReason}</p>}
      {report.honesty.checks.map((claim, index) => <article className="claim-card" key={claim.id + index}>
        <h4>{claim.claim}: {claim.status}</h4>
        <p>{claim.deduction === null ? 'Not scored. ' : claim.deduction ? '−' + claim.deduction + ' points. ' : 'No deduction. '}{claim.reason}</p>
        {claim.evidence.length > 0 && <p>Label evidence: {claim.evidence.join(', ')}</p>}
      </article>)}
      {!report.honesty.checks.length && <p>Select at least one printed claim to calculate a score.</p>}
      <p className="format-help">{report.honesty.method}</p>
    </div>}
  </section>
}

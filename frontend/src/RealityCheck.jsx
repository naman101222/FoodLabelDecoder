function display(amount) {
  if (!amount) return 'Not available'
  const value = Number.isInteger(amount.value) ? amount.value : amount.value.toFixed(1)
  return `${value} ${amount.unit}`
}

const levelCopy = {
  low: ['Within the low band', 'level-low'],
  medium: ['In the middle band', 'level-medium'],
  high: ['Above the high band', 'level-high'],
  unknown: ['Needs a clearer reading', 'level-unknown'],
}

export default function RealityCheck({ report }) {
  const view = report.nutritionView
  if (!view) return null
  const insights = view.insights || []
  const highCount = insights.filter(item => item.level === 'high').length
  const checkedClaims = report.honesty?.checks || []
  const contradicted = checkedClaims.filter(item => item.status === 'contradicted-by-read-label')
  const unresolved = checkedClaims.filter(item => item.status === 'cannot-verify' || item.status === 'no-rule-recorded')
  const amountFor = key => view.nutrients.find(item => item.key === key)?.perServing
  const sugarAmount = amountFor('total-sugars')
  const macros = [
    { label: 'Energy', amount: amountFor('energy') },
    { label: 'Carbohydrate', amount: amountFor('total-carbohydrate'), detail: sugarAmount ? `${display(sugarAmount)} total sugars` : '' },
    { label: 'Protein', amount: amountFor('protein') },
    { label: 'Dietary fibre', amount: amountFor('dietary-fiber') },
  ].filter(item => item.amount)

  let verdictTitle = 'Your label verdict'
  let verdictText
  if (contradicted.length) {
    verdictText = `${contradicted.length === 1 ? 'A selected claim conflicts' : `${contradicted.length} selected claims conflict`} with evidence read from the ingredients or nutrition panel. The claim checks below show why.`
  } else if (checkedClaims.length && unresolved.length) {
    verdictText = 'Some selected claims could not be verified from the readable label evidence. Missing evidence is not proof that a claim is false.'
  } else if (checkedClaims.length) {
    verdictText = 'The selected claims meet the checks this prototype can verify from the label. This is not a general health rating or a legal compliance decision.'
  } else {
    verdictText = 'Confirm the claims printed on the front of the pack below to check them against the ingredients and nutrition facts.'
  }

  return <div className="reality-check">
    <section className="reality-section">
      <p className="section-kicker">Reality check</p>
      <h3>Label amounts</h3>
      {view.columns.servingsPerContainer && <p className="serving-context">{view.columns.servingsPerContainer} {view.columns.servingsPerContainer === 1 ? 'serving' : 'servings'} in this pack{view.columns.servingsSource === 'estimated-from-pack-weight' ? ' · estimated from net and serving weight' : ''}</p>}
      <div className="nutrition-table-wrap">
        <table className="nutrition-table">
          <thead><tr>
            <th scope="col">Nutrient</th>
            <th scope="col">{view.columns.perServing ? 'Per serving' : view.columns.basis === 'per100ml' ? 'Per 100 ml' : view.columns.basis === 'per100g' ? 'Per 100 g' : 'As read'}{view.columns.perServing && view.columns.serving ? <small>{view.columns.serving}</small> : null}</th>
            {view.columns.wholePack && <th scope="col">Whole pack{view.columns.netWeightGrams ? <small>{view.columns.netWeightGrams} g net</small> : view.columns.netVolumeMl ? <small>{view.columns.netVolumeMl} ml net</small> : null}</th>}
          </tr></thead>
          <tbody>{view.nutrients.map(nutrient => <tr key={nutrient.key}>
            <th scope="row">{nutrient.name}</th>
            <td>{view.columns.perServing ? display(nutrient.perServing) : display(nutrient.asRead)}</td>
            {view.columns.wholePack && <td>{display(nutrient.wholePack)}</td>}
          </tr>)}</tbody>
        </table>
      </div>
      {view.columns.wholePack && view.columns.servingsPerContainer === 1 && <p className="portion-callout">This pack is one serving, so the per-serving amount is the whole-pack amount.</p>}
      {!view.columns.wholePack && <p className="format-help dark-help">Whole-pack totals need a readable serving count or net package weight. We leave them blank instead of guessing.</p>}
    </section>

    {(macros.length > 0 || view.leadingIngredients.length > 0) && <section className="reality-section snapshot-section">
      <p className="section-kicker">At a glance</p>
      <h3>What stands out</h3>
      {macros.length > 0 && <div className="snapshot-grid">{macros.map(item => <div className="snapshot-item" key={item.label}><span>{item.label}</span><strong>{display(item.amount)}</strong>{item.detail && <small>{item.detail}</small>}</div>)}</div>}
      {view.leadingIngredients.length > 0 && <p className="leading-ingredients"><strong>First ingredients listed:</strong> {view.leadingIngredients.join(' · ')}</p>}
      <p className="snapshot-note">These are facts read from the package, not predictions about how your body will respond.</p>
    </section>}

    <section className="reality-section">
      <p className="section-kicker">Red flag scanner</p>
      <h3>{view.columns.basis === 'per100ml' ? 'How much we could compare' : 'How the per-100 g numbers compare'}</h3>
      <p className="format-help dark-help">These reference bands help compare common nutrients. They do not grade the whole food.</p>
      <div className="insight-list">{insights.map(item => {
        const [label, levelClass] = levelCopy[item.level] || levelCopy.unknown
        return <article className={`insight-card ${levelClass}`} key={item.key}>
          <div className="insight-heading"><h4>{item.label}</h4><span>{label}</span></div>
          <p>{item.explanation}</p>
        </article>
      })}</div>
      {view.comparisonSource && <p className="reference-note">Comparison reference: <a href={view.comparisonSource.url} target="_blank" rel="noreferrer">{view.comparisonSource.title}</a>. This NHS guide uses per-100 g bands for foods; it is not an FSSAI threshold.</p>}
    </section>

    <section className="verdict-card">
      <p className="section-kicker">Your verdict</p>
      <h3>{verdictTitle}</h3>
      <p>{verdictText}</p>
      {highCount > 0 && <p className="verdict-note">{highCount} scanned nutrient {highCount === 1 ? 'is' : 'values are'} above the cited high band per 100 g. This is a label comparison, not a personal health judgment.</p>}
      {highCount === 0 && insights.some(item => item.level === 'unknown') && <p className="verdict-note">Some values could not be normalized or read clearly, so those comparisons are withheld.</p>}
    </section>
  </div>
}

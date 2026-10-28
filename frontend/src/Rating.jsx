export default function Rating({ report }) {
  return <>
    {report.source && <p className="format-source">Source: {report.sourceUrl ? <a href={report.sourceUrl} target="_blank" rel="noreferrer">{report.source}</a> : report.source}</p>}
    {report.rating && <section className="claim-card">
      <h3>Nutrient-level rating</h3>
      <p>{report.rating.reason}</p>
      <div className="rating-grid">{report.rating.items.map(item => <div className={'rating-item level-' + item.level} key={item.name}>
        <strong>{item.name}</strong><span>{item.level}</span>
        <span>{item.value === null ? 'Not enough reliable data' : item.value + 'g / 100g'}</span>
        {item.converted && <small>Salt equivalent from sodium × 2.5</small>}
      </div>)}</div>
      <a href={report.rating.source} target="_blank" rel="noreferrer">How these levels are defined (NHS)</a>
    </section>}
  </>
}

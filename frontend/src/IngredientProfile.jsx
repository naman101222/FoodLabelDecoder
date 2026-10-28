export default function IngredientProfile({ profile }) {
  if (!profile) return null
  return <section className="ingredient-profile">
    <h3>Ingredient profile</h3>
    <p className="profile-counts">{profile.items?.length
      ? <>Sugar ingredients: <strong>{profile.sugarCount}</strong> · Sugar aliases: <strong>{profile.hiddenSugarCount}</strong> · Classified additives: <strong>{profile.additiveCount}</strong> · Names matched in India dataset: <strong>{profile.datasetListedCount || 0}</strong></>
      : 'Ingredient counts unavailable'}</p>
    <p className="format-help">{profile.countNote || 'An ingredient list could not be read.'}</p>
    {profile.items?.length > 0 && <ul className="ingredient-list">{profile.items.map((item, index) => <li key={item.id + item.raw + index}>
      <div><strong>{item.raw}</strong><span className="ingredient-category">{item.category}</span></div>
      <p>{item.explanation}</p>
    </li>)}</ul>}
  </section>
}

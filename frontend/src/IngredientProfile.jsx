export default function IngredientProfile({ profile }) {
  if (!profile) return null
  return <section className="ingredient-profile">
    <h3>Ingredient profile</h3>
    <p className="profile-counts">
      {profile.items?.length
        ? <>Recognized sugar ingredients: <strong>{profile.sugarCount}</strong> · Recognized sugar aliases: <strong>{profile.hiddenSugarCount}</strong> · Additives: <strong>{profile.additiveCount}</strong></>
        : 'Ingredient counts unavailable'}
    </p>
    <p className="format-help">{profile.countNote || 'An ingredient list could not be read.'}</p>
    {profile.items?.length > 0 && <ul className="ingredient-list">{profile.items.map((item, index) => <li key={item.position + item.name + index}>
      <div><strong>{item.raw}</strong><span className="ingredient-category">{item.category}</span></div>
      <p>{item.explanation}</p>
    </li>)}</ul>}
  </section>
}

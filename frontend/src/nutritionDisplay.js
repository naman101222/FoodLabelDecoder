export function buildDisplayView(report) {
  const calculatedView = report.nutritionView
  const rawNutrients = Array.isArray(report.nutrients) ? report.nutrients : []
  const rawByKey = new Map(rawNutrients.filter(nutrient => nutrient.key).map(nutrient => [nutrient.key, nutrient]))
  const titleFromKey = key => typeof key === 'string'
    ? key.split(/[-_]+/).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join(' ')
    : ''
  const visibleName = (...values) => values.find(value => typeof value === 'string' && value.trim())
  const fallbackNutrients = rawNutrients.map((nutrient, index) => ({
    key: nutrient.key || nutrient.name || `nutrient-${index}`,
    name: visibleName(nutrient.name) || titleFromKey(nutrient.key) || `Nutrient ${index + 1}`,
    unit: nutrient.unit,
    asRead: { value: nutrient.value, unit: nutrient.unit },
    perServing: null,
    wholePack: null,
  }))
  const namedCalculatedNutrients = Array.isArray(calculatedView?.nutrients)
    ? calculatedView.nutrients.map((nutrient, index) => {
      const original = rawByKey.get(nutrient.key) || rawNutrients[index]
      return {
        ...nutrient,
        name: visibleName(nutrient.name, nutrient.label, original?.name) || titleFromKey(nutrient.key || original?.key) || `Nutrient ${index + 1}`,
      }
    })
    : []

  return {
    ...calculatedView,
    columns: calculatedView?.columns || { basis: report.basis || 'unknown' },
    nutrients: namedCalculatedNutrients.length ? namedCalculatedNutrients : fallbackNutrients,
    insights: calculatedView?.insights || [],
  }
}

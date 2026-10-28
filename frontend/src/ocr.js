// Prepare local OCR variants. Package panels are often photographed sideways;
// trying the common rotations avoids asking Tesseract to infer orientation.
export async function prepareImage(file, rotation = 0, threshold = false) {
  const bitmap = await createImageBitmap(file)
  try {
    const rotated = rotation % 180 !== 0
    const scale = Math.min(3, 3000 / Math.max(bitmap.width, bitmap.height))
    const width = Math.round((rotated ? bitmap.height : bitmap.width) * scale)
    const height = Math.round((rotated ? bitmap.width : bitmap.height) * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: threshold })
    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, height)
    context.save()
    context.translate(width / 2, height / 2)
    context.rotate(rotation * Math.PI / 180)
    context.filter = 'grayscale(1) contrast(1.3)'
    context.drawImage(bitmap, -bitmap.width * scale / 2, -bitmap.height * scale / 2, bitmap.width * scale, bitmap.height * scale)
    context.restore()
    if (threshold) {
      const image = context.getImageData(0, 0, width, height)
      for (let i = 0; i < image.data.length; i += 4) {
        const value = image.data[i] > 160 ? 255 : 0
        image.data[i] = image.data[i + 1] = image.data[i + 2] = value
      }
      context.putImageData(image, 0, 0)
    }
    return canvas
  } finally { bitmap.close() }
}

export async function recognizePanel(worker, file, { rotations = [0, 90, 270], onProgress = () => {} } = {}) {
  const candidates = []
  for (const rotation of rotations) {
    for (const threshold of [false, true]) {
      const image = await prepareImage(file, rotation, threshold)
      const { data } = await worker.recognize(image)
      const text = data.text.trim()
      if (text) candidates.push({ text, confidence: data.confidence, rotation, threshold })
      onProgress({ rotation, threshold, confidence: data.confidence })
      // If a clear result is found, avoid slower redundant passes.
      if (data.confidence >= 78 && text.length > 20) break
    }
    if (candidates.some(candidate => candidate.rotation === rotation && candidate.confidence >= 78 && candidate.text.length > 20)) break
  }
  candidates.sort((a, b) => b.confidence - a.confidence)
  return candidates[0] || { text: '', confidence: 0, rotation: 0, threshold: false }
}

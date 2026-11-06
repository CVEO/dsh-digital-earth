const TURN_DURATION = 24000

export function buildGlobeProjection(size, textureWidth, textureHeight) {
  const longitude = new Float32Array(size * size)
  const latitude = new Float32Array(size * size)
  const light = new Float32Array(size * size)
  const pixels = new Uint8ClampedArray(size * size * 4)
  const tilt = 15 * Math.PI / 180
  for (let pixelY = 0; pixelY < size; pixelY++) {
    for (let pixelX = 0; pixelX < size; pixelX++) {
      const east = (2 * pixelX + 1) / size - 1
      const north = 1 - (2 * pixelY + 1) / size
      const radiusSquared = east * east + north * north
      if (radiusSquared >= 1) continue
      const depth = Math.sqrt(1 - radiusSquared)
      const index = pixelY * size + pixelX
      longitude[index] = Math.atan2(east, depth * Math.cos(tilt) - north * Math.sin(tilt)) / (2 * Math.PI) * textureWidth
      latitude[index] = (0.5 - Math.asin(north * Math.cos(tilt) + depth * Math.sin(tilt)) / Math.PI) * (textureHeight - 1)
      light[index] = 0.87 + 0.13 * Math.max(0, -0.35 * east + 0.45 * north + 0.8 * depth)
      pixels[index * 4 + 3] = 255 * Math.min(1, (1 - Math.sqrt(radiusSquared)) * size / 2)
    }
  }
  return { size, textureWidth, textureHeight, longitude, latitude, light, pixels }
}

export function renderGlobePixels(projection, texture, elapsed = 0) {
  const { size, textureWidth, textureHeight, longitude, latitude, light, pixels } = projection
  const offset = ((elapsed % TURN_DURATION) / TURN_DURATION + 295 / 360) * textureWidth
  for (let index = 0; index < size * size; index++) {
    if (!pixels[index * 4 + 3]) continue
    const textureX = ((longitude[index] + offset) % textureWidth + textureWidth) % textureWidth
    const textureY = latitude[index]
    const left = Math.floor(textureX)
    const right = (left + 1) % textureWidth
    const top = Math.floor(textureY)
    const bottom = Math.min(top + 1, textureHeight - 1)
    const fractionX = textureX - left
    const fractionY = textureY - top
    const upper = texture[(top * textureWidth + left) * 4] * (1 - fractionX) + texture[(top * textureWidth + right) * 4] * fractionX
    const lower = texture[(bottom * textureWidth + left) * 4] * (1 - fractionX) + texture[(bottom * textureWidth + right) * 4] * fractionX
    const land = (upper * (1 - fractionY) + lower * fractionY) / 255
    pixels[index * 4] = (226 - 102 * land) * light[index]
    pixels[index * 4 + 1] = (242 - 70 * land) * light[index]
    pixels[index * 4 + 2] = (253 - 38 * land) * light[index]
  }
  return pixels
}

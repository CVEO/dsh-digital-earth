/**
 * test/helpers/tiff-fixture.mjs — write tiny GeoTIFFs for the reader tests.
 *
 * The plugin has no GDAL and no image library, so fixtures are built here: a
 * classic TIFF (little- or big-endian) with strips or tiles, optional
 * Deflate/PackBits compression and horizontal predictor, 8/16-bit samples, plus
 * the GeoTIFF tags a real QGIS export carries (ModelPixelScale, ModelTiepoint,
 * GeoKeyDirectory).
 */
import { deflateSync } from 'node:zlib'

const TAG = {
  width: 256,
  height: 257,
  bitsPerSample: 258,
  compression: 259,
  photometric: 262,
  stripOffsets: 273,
  samplesPerPixel: 277,
  rowsPerStrip: 278,
  stripByteCounts: 279,
  planarConfig: 284,
  predictor: 317,
  sampleFormat: 339,
  modelPixelScale: 33550,
  modelTiepoint: 33922,
  geoKeyDirectory: 34735,
  gdalNodata: 42113,
  tileWidth: 322,
  tileHeight: 323,
  tileOffsets: 324,
  tileByteCounts: 325,
}

const TYPE_SIZE = { 2: 1, 3: 2, 4: 4, 12: 8 }

/**
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {number} [options.samples] samples per pixel (1..4)
 * @param {8|16|32} [options.bits]
 * @param {'none'|'deflate'|'packbits'} [options.compression]
 * @param {1|2} [options.predictor]
 * @param {(x:number,y:number,band:number)=>number} options.pixel
 * @param {{epsg?:number,pixelSize?:[number,number],origin?:[number,number],projected?:boolean,noGeo?:boolean}} [options.geo]
 * @param {number} [options.strips]
 * @param {number} [options.tileSize] write tiled TIFF blocks instead of strips
 * @param {'II'|'MM'} [options.endian]
 * @param {number} [options.nodata]
 */
export function makeGeotiff({
  width,
  height,
  samples = 3,
  bits = 8,
  compression = 'none',
  predictor = 1,
  pixel,
  geo = {},
  strips = 1,
  tileSize = 0,
  endian = 'II',
  signed = false,
  nodata,
}) {
  const little = endian === 'II'
  const bytesPerSample = bits / 8
  const writeSample = (buffer, value, at) => {
    if (bits === 8) {
      if (signed) buffer.writeInt8(value, at)
      else buffer.writeUInt8(value, at)
    } else if (bits === 16) {
      if (signed) {
        if (little) buffer.writeInt16LE(value, at)
        else buffer.writeInt16BE(value, at)
      } else if (little) buffer.writeUInt16LE(value, at)
      else buffer.writeUInt16BE(value, at)
    } else if (little) buffer.writeUInt32LE(value, at)
    else buffer.writeUInt32BE(value, at)
  }
  const readSample = (buffer, at) =>
    bits === 8
      ? buffer.readUInt8(at)
      : bits === 16
        ? little
          ? buffer.readUInt16LE(at)
          : buffer.readUInt16BE(at)
        : little
          ? buffer.readUInt32LE(at)
          : buffer.readUInt32BE(at)
  const tiled = tileSize > 0
  const blockWidth = tiled ? tileSize : width
  const rowsPerBlock = tiled ? tileSize : Math.ceil(height / strips)
  const blocksAcross = tiled ? Math.ceil(width / tileSize) : 1
  const blocksDown = tiled ? Math.ceil(height / tileSize) : Math.ceil(height / rowsPerBlock)
  const rowBytes = blockWidth * samples * bytesPerSample

  const blocks = []
  for (let block = 0; block < blocksAcross * blocksDown; block += 1) {
    const blockX = tiled ? (block % blocksAcross) * tileSize : 0
    const blockY = tiled ? Math.floor(block / blocksAcross) * tileSize : block * rowsPerBlock
    if (blockY >= height) break
    const buffer = Buffer.alloc(rowBytes * rowsPerBlock)
    let at = 0
    for (let row = 0; row < rowsPerBlock; row += 1) {
      for (let column = 0; column < blockWidth; column += 1) {
        // Edge pixels repeat the last real column/row so tiles are full size
        // without inventing nodata.
        const x = Math.min(width - 1, blockX + column)
        const y = Math.min(height - 1, blockY + row)
        for (let band = 0; band < samples; band += 1) {
          const low = signed ? (bits === 8 ? -128 : bits === 16 ? -32768 : -2147483648) : 0
          const high = signed ? (bits === 8 ? 127 : bits === 16 ? 32767 : 2147483647) : bits === 8 ? 255 : bits === 16 ? 65535 : 4294967295
          const value = Math.max(low, Math.min(high, Math.round(pixel(x, y, band))))
          writeSample(buffer, value, at)
          at += bytesPerSample
        }
      }
    }
    if (predictor === 2) {
      for (let row = 0; row < rowsPerBlock; row += 1) {
        const base = row * rowBytes
        for (let index = blockWidth * samples - 1; index >= samples; index -= 1) {
          const current = base + index * bytesPerSample
          const left = base + (index - samples) * bytesPerSample
          const delta = (readSample(buffer, current) - readSample(buffer, left) + (bits === 8 ? 256 : bits === 16 ? 65536 : 4294967296)) & (bits === 8 ? 0xff : bits === 16 ? 0xffff : 0xffffffff)
          writeSample(buffer, delta, current)
        }
      }
    }
    blocks.push(buffer)
  }

  const encoded = blocks.map((buffer) => {
    if (compression === 'deflate') return deflateSync(buffer)
    if (compression === 'packbits') return packBits(buffer)
    return buffer
  })

  const entries = []
  const add = (tag, type, values) => entries.push({ tag, type, values })
  add(TAG.width, 4, [width])
  add(TAG.height, 4, [height])
  add(TAG.bitsPerSample, 3, Array.from({ length: samples }, () => bits))
  add(TAG.compression, 3, [compression === 'deflate' ? 8 : compression === 'packbits' ? 32773 : 1])
  add(TAG.photometric, 3, [samples >= 3 ? 2 : 1])
  add(TAG.samplesPerPixel, 3, [samples])
  add(TAG.planarConfig, 3, [1])
  add(TAG.sampleFormat, 3, Array.from({ length: samples }, () => (signed ? 2 : 1)))
  if (predictor !== 1) add(TAG.predictor, 3, [predictor])
  if (nodata !== undefined) add(TAG.gdalNodata, 2, [...Buffer.from(String(nodata), 'latin1'), 0])
  if (!geo.noGeo) {
    const [sx, sy] = geo.pixelSize ?? [0.0001, 0.0001]
    const [x0, y0] = geo.origin ?? [116.3, 39.9]
    add(TAG.modelPixelScale, 12, [sx, sy, 0])
    add(TAG.modelTiepoint, 12, [0, 0, 0, x0, y0, 0])
    const epsg = geo.epsg ?? 4326
    add(
      TAG.geoKeyDirectory,
      3,
      geo.projected
        ? [1, 1, 0, 1, 1024, 0, 1, 1, 1025, 0, 1, 1, 3072, 0, 1, epsg]
        : [1, 1, 0, 1, 1024, 0, 1, 2, 1025, 0, 1, 1, 2048, 0, 1, epsg],
    )
  }
  if (tiled) {
    add(TAG.tileWidth, 4, [tileSize])
    add(TAG.tileHeight, 4, [tileSize])
    add(TAG.tileOffsets, 4, Array.from({ length: encoded.length }, () => 0))
    add(TAG.tileByteCounts, 4, encoded.map((buffer) => buffer.length))
  } else {
    add(TAG.rowsPerStrip, 4, [rowsPerBlock])
    add(TAG.stripOffsets, 4, Array.from({ length: encoded.length }, () => 0))
    add(TAG.stripByteCounts, 4, encoded.map((buffer) => buffer.length))
  }
  entries.sort((a, b) => a.tag - b.tag)

  const ifdSize = 2 + entries.length * 12 + 4
  let cursor = 8 + ifdSize
  const valueOffsets = new Map()
  for (const entry of entries) {
    const size = TYPE_SIZE[entry.type] * entry.values.length
    if (size <= 4) continue
    if (cursor % 2 === 1) cursor += 1
    valueOffsets.set(entry.tag, cursor)
    cursor += size
  }
  const offsets = []
  let imageCursor = cursor
  for (const buffer of encoded) {
    offsets.push(imageCursor)
    imageCursor += buffer.length
  }
  const out = Buffer.alloc(imageCursor)
  const w16 = (value, at) => (little ? out.writeUInt16LE(value, at) : out.writeUInt16BE(value, at))
  const w32 = (value, at) => (little ? out.writeUInt32LE(value, at) : out.writeUInt32BE(value, at))
  const wDouble = (value, at) => (little ? out.writeDoubleLE(value, at) : out.writeDoubleBE(value, at))
  out.write(endian, 0, 'latin1')
  w16(42, 2)
  w32(8, 4)
  w16(entries.length, 8)
  entries.forEach((entry, index) => {
    const offsetTag = tiled ? TAG.tileOffsets : TAG.stripOffsets
    const values = entry.tag === offsetTag ? offsets : entry.values
    const base = 10 + index * 12
    w16(entry.tag, base)
    w16(entry.type, base + 2)
    w32(values.length, base + 4)
    const size = TYPE_SIZE[entry.type] * values.length
    const inline = size <= 4
    const target = inline ? base + 8 : valueOffsets.get(entry.tag)
    values.forEach((value, valueIndex) => {
      if (entry.type === 12) wDouble(value, target + valueIndex * 8)
      else if (entry.type === 4) w32(value, target + valueIndex * 4)
      else if (entry.type === 3) w16(value, target + valueIndex * 2)
      else out[target + valueIndex] = value
    })
    if (!inline) w32(target, base + 8)
  })
  let block = cursor
  for (const buffer of encoded) {
    buffer.copy(out, block)
    block += buffer.length
  }
  return out
}

function packBits(input) {
  const chunks = []
  for (let index = 0; index < input.length; index += 128) {
    const slice = input.subarray(index, index + 128)
    chunks.push(Buffer.from([slice.length - 1]), slice)
  }
  return Buffer.concat(chunks)
}

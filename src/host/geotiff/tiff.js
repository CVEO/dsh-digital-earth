/**
 * host/geotiff/tiff.js — a small, dependency-free TIFF/GeoTIFF reader.
 *
 * Scope is deliberately narrow and honest: what an aerial survey operator drops
 * on the globe is a GeoTIFF with strips or tiles, 8/16-bit integer or 32-bit
 * float samples, uncompressed or Deflate/LZW/PackBits, one image per file. That
 * is what this module reads. Everything else (JPEG-in-TIFF, LERC, ZSTD, BigTIFF,
 * JPEG2000, RPC-only satellite scenes) is detected and rejected with a message
 * the panel can show verbatim, instead of failing halfway through a publish job.
 *
 * The reader is random-access: it takes a `read(offset, length)` function so the
 * host can serve a 2 GB file without loading it, and tests can serve a Buffer.
 * Decoded blocks are cached (bounded) because a pyramid publish reads the same
 * strip for level 0, level 1, ... in a row.
 */
import { inflateSync } from 'node:zlib'
import { promises as fs } from 'node:fs'

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
  colorMap: 320,
  tileWidth: 322,
  tileHeight: 323,
  tileOffsets: 324,
  tileByteCounts: 325,
  sampleFormat: 339,
  modelPixelScale: 33550,
  modelTiepoint: 33922,
  modelTransformation: 34264,
  geoKeyDirectory: 34735,
  gdalNodata: 42113,
}

const COMPRESSION = {
  1: 'none',
  5: 'lzw',
  8: 'deflate',
  9: 'deflate',
  32946: 'deflate',
  32773: 'packbits',
  7: 'jpeg',
  34887: 'lerc',
  50000: 'zstd',
  50001: 'webp',
}

/** Compression families this reader can decode. */
export const DECODABLE = new Set(['none', 'deflate', 'lzw', 'packbits'])

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8, 17: 8, 18: 8 }

export class TiffError extends Error {
  constructor(code, message, detail = {}) {
    super(message)
    this.name = 'TiffError'
    this.code = code
    this.detail = detail
  }
}

/** Reverse the horizontal-differencing predictor of a decoded block. */
function undoPredictor(bytes, blockWidth, rows, samplesPerPixel, bits, little) {
  const bytesPerSample = bits / 8
  const samplesPerRow = blockWidth * samplesPerPixel
  for (let row = 0; row < rows; row += 1) {
    const start = row * samplesPerRow * bytesPerSample
    for (let index = samplesPerPixel; index < samplesPerRow; index += 1) {
      if (bytesPerSample === 1) {
        bytes[start + index] = (bytes[start + index] + bytes[start + index - samplesPerPixel]) & 0xff
      } else if (bytesPerSample === 2) {
        const at = start + index * 2
        const left = start + (index - samplesPerPixel) * 2
        const value = (little ? bytes.readUInt16LE(at) : bytes.readUInt16BE(at)) + (little ? bytes.readUInt16LE(left) : bytes.readUInt16BE(left))
        if (little) bytes.writeUInt16LE(value & 0xffff, at)
        else bytes.writeUInt16BE(value & 0xffff, at)
      } else if (bytesPerSample === 4) {
        const at = start + index * 4
        const left = start + (index - samplesPerPixel) * 4
        const value = (little ? bytes.readUInt32LE(at) : bytes.readUInt32BE(at)) + (little ? bytes.readUInt32LE(left) : bytes.readUInt32BE(left))
        if (little) bytes.writeUInt32LE(value >>> 0, at)
        else bytes.writeUInt32BE(value >>> 0, at)
      }
    }
  }
}

/** LZW decompression with the TIFF "early change" convention. */
function lzwDecode(input, maxOutput = 1 << 26) {
  const dictionary = []
  const reset = () => {
    dictionary.length = 0
    for (let index = 0; index < 256; index += 1) dictionary.push(Buffer.from([index]))
    dictionary.push(null, null)
  }
  reset()
  const output = []
  let bitPosition = 0
  let codeBits = 9
  let previous = null
  const readCode = () => {
    if (bitPosition + codeBits > input.length * 8) return -1
    let code = 0
    for (let bit = 0; bit < codeBits; bit += 1) {
      const at = bitPosition + bit
      code = (code << 1) | ((input[at >> 3] >> (7 - (at & 7))) & 1)
    }
    bitPosition += codeBits
    return code
  }
  for (;;) {
    const code = readCode()
    if (code < 0) break
    if (code === 256) {
      reset()
      codeBits = 9
      previous = null
      continue
    }
    if (code === 257) break
    let entry
    if (code < dictionary.length && dictionary[code] !== null) entry = dictionary[code]
    else if (previous !== null) entry = Buffer.concat([previous, previous.subarray(0, 1)])
    else throw new TiffError('compression', 'LZW stream is corrupt')
    output.push(entry)
    if (previous !== null) dictionary.push(Buffer.concat([previous, entry.subarray(0, 1)]))
    previous = entry
    // Early change: widen one code sooner than a naive encoder would.
    if (dictionary.length + 1 >= 1 << codeBits && codeBits < 12) codeBits += 1
    if (output.length > maxOutput) throw new TiffError('compression', 'LZW stream expands beyond its declared block size')
  }
  return Buffer.concat(output)
}

function packBitsDecode(input) {
  const chunks = []
  let index = 0
  while (index < input.length) {
    const header = input.readInt8(index)
    index += 1
    if (header >= 0) {
      chunks.push(input.subarray(index, index + header + 1))
      index += header + 1
    } else if (header !== -128) {
      chunks.push(Buffer.alloc(1 - header, input[index]))
      index += 1
    }
  }
  return Buffer.concat(chunks)
}

/** Read one tag's value bytes (inline or at an offset) as a normalised array. */
function tagValues(entry, little) {
  const { bytes, type, length } = entry
  const values = []
  const width = TYPE_SIZE[type] ?? 1
  if (bytes.length < length * width) {
    throw new TiffError('truncated', 'TIFF tag data is shorter than its declared length')
  }
  for (let index = 0; index < length; index += 1) {
    const at = index * width
    if (type === 3) values.push(little ? bytes.readUInt16LE(at) : bytes.readUInt16BE(at))
    else if (type === 4) values.push(little ? bytes.readUInt32LE(at) : bytes.readUInt32BE(at))
    else if (type === 12) values.push(little ? bytes.readDoubleLE(at) : bytes.readDoubleBE(at))
    else if (type === 11) values.push(little ? bytes.readFloatLE(at) : bytes.readFloatBE(at))
    else if (type === 8) values.push(little ? bytes.readInt16LE(at) : bytes.readInt16BE(at))
    else if (type === 9) values.push(little ? bytes.readInt32LE(at) : bytes.readInt32BE(at))
    else values.push(bytes[at])
  }
  return values
}

/**
 * Open a TIFF through a random-access reader.
 *
 * @param {{ size:number, read:(offset:number, length:number)=>Promise<Buffer> }} source
 */
export async function openTiff(source, { cacheLimit = 64 * 1024 * 1024 } = {}) {
  const header = await source.read(0, Math.min(16, source.size))
  if (header.length < 8) throw new TiffError('truncated', 'Not a TIFF file (header too short)')
  const order = header.toString('latin1', 0, 2)
  if (order !== 'II' && order !== 'MM') throw new TiffError('not_tiff', 'Not a TIFF file')
  const little = order === 'II'
  const u16 = (buffer, at) => (little ? buffer.readUInt16LE(at) : buffer.readUInt16BE(at))
  const u32 = (buffer, at) => (little ? buffer.readUInt32LE(at) : buffer.readUInt32BE(at))
  if (u16(header, 2) === 43) {
    throw new TiffError('bigtiff', 'BigTIFF is not supported yet; export a classic (COG/STACKED) TIFF')
  }
  if (u16(header, 2) !== 42) throw new TiffError('not_tiff', 'Not a TIFF file (bad magic)')

  const ifdOffset = u32(header, 4)
  if (ifdOffset < 8 || ifdOffset >= source.size) throw new TiffError('truncated', 'TIFF directory offset points outside the file')
  const countBuffer = await source.read(ifdOffset, 2)
  if (countBuffer.length < 2) throw new TiffError('truncated', 'TIFF directory is truncated')
  const count = u16(countBuffer, 0)
  if (count === 0 || count > 4096) throw new TiffError('corrupt', 'TIFF directory is implausibly large')
  const directory = await source.read(ifdOffset + 2, count * 12)
  if (directory.length < count * 12) throw new TiffError('truncated', 'TIFF directory is truncated')
  const entries = new Map()
  for (let index = 0; index < count; index += 1) {
    const at = index * 12
    const tag = u16(directory, at)
    const type = u16(directory, at + 2)
    const length = u32(directory, at + 4)
    const size = (TYPE_SIZE[type] ?? 1) * length
    const valueOffset = size <= 4 ? null : u32(directory, at + 8)
    const bytes =
      size <= 4
        ? directory.subarray(at + 8, at + 8 + size)
        : await source.read(valueOffset, size)
    entries.set(tag, { type, length, size, bytes })
  }
  const valuesOf = (tag) => (entries.has(tag) ? tagValues(entries.get(tag), little) : [])
  const number = (tag, fallback) => {
    const values = valuesOf(tag)
    return values.length > 0 ? values[0] : fallback
  }
  const text = (tag) => {
    const entry = entries.get(tag)
    return entry ? entry.bytes.toString('latin1').replace(/\0+$/, '') : ''
  }

  const width = number(TAG.width, 0)
  const height = number(TAG.height, 0)
  if (!width || !height) throw new TiffError('corrupt', 'TIFF has no image dimensions')
  const compressionCode = number(TAG.compression, 1)
  const compression = COMPRESSION[compressionCode] ?? `unknown(${compressionCode})`
  const samplesPerPixel = number(TAG.samplesPerPixel, 1)
  const bits = valuesOf(TAG.bitsPerSample).length > 0 ? valuesOf(TAG.bitsPerSample) : [8]
  const sampleFormat = valuesOf(TAG.sampleFormat).length > 0 ? valuesOf(TAG.sampleFormat) : [1]
  const planarConfig = number(TAG.planarConfig, 1)
  const predictor = number(TAG.predictor, 1)
  const tileWidth = number(TAG.tileWidth, 0)
  const tileHeight = number(TAG.tileHeight, 0)
  const rowsPerStrip = number(TAG.rowsPerStrip, height)
  const photometric = number(TAG.photometric, samplesPerPixel >= 3 ? 2 : 1)
  const colorMap = valuesOf(TAG.colorMap)
  const nodataText = text(TAG.gdalNodata).trim()
  const nodata = nodataText === '' || Number.isNaN(Number(nodataText)) ? null : Number(nodataText)
  const tiled = tileWidth > 0 && tileHeight > 0
  const offsets = tiled ? valuesOf(TAG.tileOffsets) : valuesOf(TAG.stripOffsets)
  const byteCounts = tiled ? valuesOf(TAG.tileByteCounts) : valuesOf(TAG.stripByteCounts)
  if (offsets.length === 0) throw new TiffError('corrupt', 'TIFF has no strip or tile offsets')
  if (bits.some((value) => value !== 8 && value !== 16 && value !== 32)) {
    throw new TiffError('unsupported_bits', `Unsupported sample depth ${[...new Set(bits)].join('/')} bit`)
  }
  if (planarConfig === 2 && samplesPerPixel > 1) {
    throw new TiffError('planar', 'Planar (separate plane) TIFFs are not supported; export an interleaved TIFF')
  }
  if (predictor === 3) {
    throw new TiffError(
      'predictor',
      'Floating-point predictor TIFFs are not supported yet; export with gdal_translate -co PREDICTOR=1 (or COMPRESS=NONE)',
    )
  }
  if (!DECODABLE.has(compression)) {
    const label = compression === 'jpeg' ? 'JPEG' : compression.toUpperCase()
    throw new TiffError(
      'compression',
      `GeoTIFF compression "${label}" is not supported yet; export with DEFLATE or LZW (gdal_translate -co COMPRESS=DEFLATE)`,
    )
  }

  const blockWidth = tiled ? tileWidth : width
  const blocksAcross = tiled ? Math.ceil(width / tileWidth) : 1
  const rowsPerBlock = tiled ? tileHeight : rowsPerStrip
  const blocksDown = tiled ? Math.ceil(height / tileHeight) : Math.ceil(height / rowsPerStrip)
  const cache = new Map()
  let cacheBytes = 0
  const CACHE_LIMIT = cacheLimit
  const isFloat = (sampleFormat[0] ?? 1) === 3

  // A corrupt byteCount must never make us allocate gigabytes: the decoded block
  // can not be larger than its own geometry (times a small slack for padding).
  const maxBlockBytes = blockWidth * rowsPerBlock * samplesPerPixel * (Math.max(...bits, 8) / 8)
  // One block can be the whole image when the file is a single strip. Refuse a
  // block that would need hundreds of megabytes instead of exhausting the host.
  const ABSOLUTE_BLOCK_LIMIT = 160 * 1024 * 1024
  const decodeLimit = Math.ceil(maxBlockBytes * 1.1) + 4096
  if (decodeLimit > ABSOLUTE_BLOCK_LIMIT) {
    throw new TiffError(
      'too_large',
      'This TIFF stores too many pixels in one block; export it tiled or with more strips (gdal_translate -co TILED=YES)',
    )
  }

  const decodeBlock = async (index) => {
    const cached = cache.get(index)
    if (cached) return cached
    const offset = offsets[index]
    const count = byteCounts[index] ?? 0
    if (!Number.isFinite(offset) || offset < 0 || count <= 0) return null
    if (count > source.size || offset + count > source.size) {
      throw new TiffError('corrupt', 'TIFF block byte count points outside the file')
    }
    const raw = await source.read(offset, count)
    let decoded
    if (compression === 'none') decoded = raw
    else if (compression === 'deflate') {
      try {
        decoded = inflateSync(raw, { maxOutputLength: decodeLimit })
      } catch (error) {
        throw new TiffError('compression', `Deflate stream is corrupt: ${error.message}`)
      }
    } else if (compression === 'lzw') decoded = lzwDecode(raw, decodeLimit)
    else decoded = packBitsDecode(raw)
    if (decoded.length > decodeLimit) {
      throw new TiffError('compression', 'Decoded TIFF block is larger than its declared geometry')
    }
    if (predictor === 2 && decoded.length > 0) {
      decoded = Buffer.from(decoded)
      const rows = tiled ? tileHeight : Math.min(rowsPerBlock, height - index * rowsPerBlock)
      undoPredictor(decoded, blockWidth, rows, samplesPerPixel, bits[0] ?? 8, little)
    }
    cacheBytes += decoded.length
    cache.set(index, decoded)
    while (cacheBytes > CACHE_LIMIT && cache.size > 1) {
      const oldest = cache.keys().next().value
      cacheBytes -= cache.get(oldest).length
      cache.delete(oldest)
    }
    return decoded
  }

  const bytesPerSample = (band) => (bits[band] ?? bits[0] ?? 8) / 8
  const signedOf = (band) => (sampleFormat[band] ?? sampleFormat[0] ?? 1) === 2
  const readSample = (bytes, band, localCol, localRow) => {
    if (bytes === null) return null
    const size = bytesPerSample(band)
    const at = (localRow * blockWidth + localCol) * samplesPerPixel * size + band * size
    if (at + size > bytes.length) return null
    if (size === 1) return signedOf(band) ? (bytes[at] << 24) >> 24 : bytes[at]
    if (size === 2) {
      if (signedOf(band)) return little ? bytes.readInt16LE(at) : bytes.readInt16BE(at)
      return little ? bytes.readUInt16LE(at) : bytes.readUInt16BE(at)
    }
    if (isFloat) return little ? bytes.readFloatLE(at) : bytes.readFloatBE(at)
    return signedOf(band)
      ? little
        ? bytes.readInt32LE(at)
        : bytes.readInt32BE(at)
      : little
        ? bytes.readUInt32LE(at)
        : bytes.readUInt32BE(at)
  }

  /**
   * Read a window into `outWidth × outHeight` samples per band.
   * Downsampling is a box average (preview quality); upsampling is nearest.
   */
  const readWindow = async ({ col = 0, row = 0, width: windowWidth = width, height: windowHeight = height, outWidth, outHeight, bands } = {}) => {
    const bandList =
      Array.isArray(bands) && bands.length > 0
        ? bands
        : Array.from({ length: samplesPerPixel }, (_, index) => index)
    const outW = Math.max(1, Math.round(outWidth ?? windowWidth))
    const outH = Math.max(1, Math.round(outHeight ?? windowHeight))
    const scaleX = windowWidth / outW
    const scaleY = windowHeight / outH
    // Pre-decode every block the window touches; sampling then runs synchronously.
    const needed = new Set()
    const blockOf = (sourceX, sourceY) => {
      if (sourceX < 0 || sourceY < 0 || sourceX >= width || sourceY >= height) return -1
      return tiled
        ? Math.floor(sourceY / tileHeight) * blocksAcross + Math.floor(sourceX / tileWidth)
        : Math.floor(sourceY / rowsPerBlock)
    }
    for (let sourceY = Math.floor(row); sourceY < Math.min(height, row + windowHeight); sourceY += Math.max(1, Math.floor(scaleY))) {
      for (let sourceX = Math.floor(col); sourceX < Math.min(width, col + windowWidth); sourceX += Math.max(1, Math.floor(scaleX))) {
        const block = blockOf(sourceX, sourceY)
        if (block >= 0) needed.add(block)
      }
    }
    const windowBlocks = new Map()
    const load = async (block) => {
      if (windowBlocks.has(block) || block < 0) return
      const bytes = await decodeBlock(block)
      if (bytes !== null) windowBlocks.set(block, bytes)
    }
    const blockRow = (block) => (tiled ? Math.floor(block / blocksAcross) : block)
    const lastRowOf = (block) =>
      tiled
        ? Math.min(height - 1, (blockRow(block) + 1) * tileHeight - 1)
        : Math.min(height - 1, (blockRow(block) + 1) * rowsPerBlock - 1)
    const sampleAt = (band, sourceX, sourceY) => {
      const block = blockOf(sourceX, sourceY)
      if (block < 0) return null
      const localCol = tiled ? sourceX % tileWidth : sourceX
      const localRow = tiled ? sourceY % tileHeight : sourceY % rowsPerBlock
      return readSample(windowBlocks.get(block) ?? null, band, localCol, localRow)
    }
    const stepsX = Math.max(1, Math.min(4, Math.floor(scaleX)))
    const stepsY = Math.max(1, Math.min(4, Math.floor(scaleY)))
    const output = bandList.map(() => new Float32Array(outW * outH))
    for (let outY = 0; outY < outH; outY += 1) {
      const centerY = row + outY * scaleY + scaleY / 2
      // Decode only the block rows this output row samples, then drop the rows
      // that no later output row can reach.
      const bandTop = Math.max(0, Math.floor(centerY - scaleY / 2 - stepsY))
      const bandBottom = Math.min(height - 1, Math.ceil(centerY + scaleY / 2 + stepsY))
      const stepX = Math.max(1, Math.floor(scaleX))
      for (let sourceY = bandTop; sourceY <= bandBottom; sourceY += 1) {
        for (let sourceX = Math.floor(col); sourceX < Math.min(width, col + windowWidth); sourceX += stepX) {
          const block = blockOf(sourceX, sourceY)
          if (block >= 0) await load(block)
        }
      }
      for (const block of [...windowBlocks.keys()]) {
        if (lastRowOf(block) < centerY - scaleY) windowBlocks.delete(block)
      }
      for (let outX = 0; outX < outW; outX += 1) {
        const centerX = col + outX * scaleX + scaleX / 2
        for (let bandIndex = 0; bandIndex < bandList.length; bandIndex += 1) {
          let sum = 0
          let count = 0
          for (let sy = 0; sy < stepsY; sy += 1) {
            for (let sx = 0; sx < stepsX; sx += 1) {
              const value = sampleAt(
                bandList[bandIndex],
                Math.floor(centerX + (sx - (stepsX - 1) / 2) * (scaleX / stepsX)),
                Math.floor(centerY + (sy - (stepsY - 1) / 2) * (scaleY / stepsY)),
              )
              if (value === null || (nodata !== null && value === nodata)) continue
              sum += value
              count += 1
            }
          }
          output[bandIndex][outY * outW + outX] = count > 0 ? sum / count : Number.NaN
        }
      }
    }
    return { width: outW, height: outH, bands: output }
  }

  const geokeys = {}
  const keyDirectory = valuesOf(TAG.geoKeyDirectory)
  for (let index = 0; index + 3 < keyDirectory.length; index += 4) {
    geokeys[keyDirectory[index]] = {
      location: keyDirectory[index + 1],
      count: keyDirectory[index + 2],
      value: keyDirectory[index + 3],
    }
  }

  return {
    width,
    height,
    samplesPerPixel,
    bits,
    sampleFormat,
    compression,
    photometric,
    predictor,
    planarConfig,
    tiled,
    tileWidth: blockWidth,
    tileHeight: rowsPerBlock,
    blocksAcross,
    blocksDown,
    colorMap,
    nodata,
    pixelScale: valuesOf(TAG.modelPixelScale),
    tiepoint: valuesOf(TAG.modelTiepoint),
    transformation: valuesOf(TAG.modelTransformation),
    geokeys,
    keyValue: (key) => geokeys[key]?.value,
    readWindow,
    close() {
      cache.clear()
      cacheBytes = 0
    },
  }
}

/** Open a TIFF file from disk without reading it whole. */
export async function openTiffFile(filePath, options = {}) {
  const handle = await fs.open(filePath, 'r')
  const stat = await handle.stat()
  let reader
  try {
    reader = await openTiff(
      {
      size: stat.size,
      read: async (offset, length) => {
        const buffer = Buffer.allocUnsafe(length)
        const { bytesRead } = await handle.read(buffer, 0, length, offset)
        return buffer.subarray(0, bytesRead)
      },
      },
      options,
    )
  } catch (error) {
    await handle.close().catch(() => {})
    throw error
  }
  const closeReader = reader.close
  return {
    ...reader,
    close() {
      closeReader()
      void handle.close().catch(() => {})
    },
  }
}

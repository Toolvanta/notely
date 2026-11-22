// Generates crisp PNG icons for the extension with zero external dependencies.
// Renders at 4x resolution and downsamples for smooth edges.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'icons')

const S = 4
const BASE = 128
const W = BASE * S

const buf = new Uint8ClampedArray(W * W * 4)

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const lerp = (a, b, t) => a + (b - a) * t

function blend(x, y, r, g, b, a = 1) {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || y < 0 || x >= W || y >= W || a <= 0) return
  const i = (y * W + x) * 4
  const na = clamp(a, 0, 1)
  buf[i] = lerp(buf[i], r, na)
  buf[i + 1] = lerp(buf[i + 1], g, na)
  buf[i + 2] = lerp(buf[i + 2], b, na)
  buf[i + 3] = clamp(buf[i + 3] + 255 * na * (1 - buf[i + 3] / 255), 0, 255)
}

function roundRect(x, y, w, h, radius, color) {
  const r = radius * S
  const x0 = x * S
  const y0 = y * S
  const ww = w * S
  const hh = h * S
  const innerX1 = x0 + ww - r
  const innerY1 = y0 + hh - r
  const minX = Math.floor(x0 - 1)
  const maxX = Math.ceil(x0 + ww + 1)
  const minY = Math.floor(y0 - 1)
  const maxY = Math.ceil(y0 + hh + 1)
  for (let py = minY; py < maxY; py++) {
    for (let px = minX; px < maxX; px++) {
      const cx = clamp(px, x0 + r, innerX1)
      const cy = clamp(py, y0 + r, innerY1)
      const dx = px - cx
      const dy = py - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const cov = clamp(r + 0.5 - dist, 0, 1)
      if (cov <= 0) continue
      const c = typeof color === 'function' ? color(px / S, py / S) : color
      blend(px, py, c[0], c[1], c[2], (c[3] ?? 1) * cov)
    }
  }
}

function triangle(p0, p1, p2, color) {
  const [ax, ay] = p0.map((v) => v * S)
  const [bx, by] = p1.map((v) => v * S)
  const [cx, cy] = p2.map((v) => v * S)
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
  if (area === 0) return
  const minX = Math.floor(Math.min(ax, bx, cx))
  const maxX = Math.ceil(Math.max(ax, bx, cx))
  const minY = Math.floor(Math.min(ay, by, cy))
  const maxY = Math.ceil(Math.max(ay, by, cy))
  for (let py = minY; py < maxY; py++) {
    for (let px = minX; px < maxX; px++) {
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area
      const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area
      const w2 = 1 - w0 - w1
      if (w0 >= -0.002 && w1 >= -0.002 && w2 >= -0.002) {
        blend(px, py, color[0], color[1], color[2], color[3] ?? 1)
      }
    }
  }
}

// --- Draw the icon in a 128x128 design space ---
const from = [124, 92, 255] // violet
const to = [64, 156, 255] // azure

// Soft drop shadow behind the whole tile
roundRect(18, 20, 92, 94, 30, [30, 20, 80, 0.16])

// Gradient tile
roundRect(16, 16, 96, 96, 28, (px, py) => {
  const t = clamp((px - 16 + py - 16) / (96 + 96), 0, 1)
  return [
    Math.round(lerp(from[0], to[0], t)),
    Math.round(lerp(from[1], to[1], t)),
    Math.round(lerp(from[2], to[2], t)),
    1,
  ]
})

// Top glossy highlight
roundRect(24, 22, 80, 40, 22, [255, 255, 255, 0.1])

// Paper shadow
roundRect(38, 32, 58, 72, 9, [24, 18, 70, 0.28])
// Paper
roundRect(36, 30, 58, 72, 9, [255, 255, 255, 0.97])

// Folded corner
triangle([80, 30], [94, 30], [80, 44], [205, 210, 240, 1])
triangle([80, 30], [94, 30], [94, 44], [232, 235, 250, 1])

// Text lines
const line = [186, 180, 240, 1]
const lineSoft = [214, 210, 244, 1]
roundRect(46, 50, 30, 4, 2, [110, 96, 220, 1])
roundRect(46, 62, 36, 3.5, 1.75, line)
roundRect(46, 72, 30, 3.5, 1.75, lineSoft)
roundRect(46, 82, 33, 3.5, 1.75, lineSoft)

// Downsample 4x4 -> 1x1
function downsample(size) {
  const out = new Uint8ClampedArray(size * size * 4)
  const factor = W / size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0
      const x0 = Math.floor(x * factor)
      const x1 = Math.floor((x + 1) * factor)
      const y0 = Math.floor(y * factor)
      const y1 = Math.floor((y + 1) * factor)
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * W + sx) * 4
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3]; n++
        }
      }
      const o = (y * size + x) * 4
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n
    }
  }
  return out
}

// --- Minimal PNG encoder ---
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    for (let x = 0; x < size * 4; x++) {
      raw[y * (size * 4 + 1) + 1 + x] = rgba[y * size * 4 + x]
    }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of [16, 32, 48, 128]) {
  const png = encodePNG(size, downsample(size))
  writeFileSync(join(OUT_DIR, `icon${size}.png`), png)
  console.log(`Generated icon${size}.png`)
}

// Zip the production build (dist/) for upload to the Chrome Web Store.
// Usage: npm run package   →   release/notely-<version>.zip
// Dependency-free: writes a standard ZIP (deflate) with Node's zlib.
import { deflateRawSync } from 'node:zlib'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'))
const outDir = join(root, 'release')
const outFile = join(outDir, `notely-${manifest.version}.zip`)

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, day }
}

const files = walk(dist).sort()
const locals = []
const centrals = []
let offset = 0
const { time, day } = dosTime(new Date())

for (const file of files) {
  const name = Buffer.from(relative(dist, file).split(sep).join('/'), 'utf8')
  const data = readFileSync(file)
  const compressed = deflateRawSync(data, { level: 9 })
  const crc = crc32(data)

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4) // version needed
  local.writeUInt16LE(0x0800, 6) // UTF-8 names
  local.writeUInt16LE(8, 8) // deflate
  local.writeUInt16LE(time, 10)
  local.writeUInt16LE(day, 12)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(compressed.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(name.length, 26)
  locals.push(local, name, compressed)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(0x0800, 8)
  central.writeUInt16LE(8, 10)
  central.writeUInt16LE(time, 12)
  central.writeUInt16LE(day, 14)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(compressed.length, 20)
  central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(name.length, 28)
  central.writeUInt32LE(offset, 42)
  centrals.push(central, name)

  offset += local.length + name.length + compressed.length
}

const centralSize = centrals.reduce((n, b) => n + b.length, 0)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(files.length, 8)
end.writeUInt16LE(files.length, 10)
end.writeUInt32LE(centralSize, 12)
end.writeUInt32LE(offset, 16)

mkdirSync(outDir, { recursive: true })
writeFileSync(outFile, Buffer.concat([...locals, ...centrals, end]))
console.log(`Packaged ${files.length} files → ${relative(root, outFile)} (${(statSync(outFile).size / 1024).toFixed(0)} KB)`)

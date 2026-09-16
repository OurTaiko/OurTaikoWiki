import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = await readFile(join(root, 'assets/branding/icon.png'))
const sizes = [16, 32, 48, 180, 192, 512]
const images = new Map(
  await Promise.all(
    sizes.map(async (size) => [
      size,
      await sharp(source)
        .resize(size, size, { fit: 'contain', background: '#ffffff' })
        .flatten({ background: '#ffffff' })
        .png()
        .toBuffer(),
    ]),
  ),
)

async function write(relative, data) {
  const target = join(root, 'public', relative)
  try {
    if ((await readFile(target)).equals(data)) return
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, data)
}

// Windows Vista+ and current browsers accept PNG-compressed ICO entries.
const icoSizes = [16, 32, 48]
const directory = Buffer.alloc(6 + 16 * icoSizes.length)
directory.writeUInt16LE(1, 2)
directory.writeUInt16LE(icoSizes.length, 4)
let offset = directory.length
for (const [index, size] of icoSizes.entries()) {
  const entry = 6 + index * 16
  directory[entry] = directory[entry + 1] = size
  directory.writeUInt16LE(1, entry + 4)
  directory.writeUInt16LE(32, entry + 6)
  directory.writeUInt32LE(images.get(size).length, entry + 8)
  directory.writeUInt32LE(offset, entry + 12)
  offset += images.get(size).length
}

await Promise.all([
  ...[32, 192, 512].map((size) => write(`icons/icon-${size}.png`, images.get(size))),
  write('apple-touch-icon.png', images.get(180)),
  write('favicon.ico', Buffer.concat([directory, ...icoSizes.map((size) => images.get(size))])),
])
console.log('Generated web icons from assets/branding/icon.png.')

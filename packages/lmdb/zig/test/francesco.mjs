import test from 'ava'
// import { LoremIpsum } from 'lorem-ipsum'
import { join, dirname } from 'path'
import { fileURLToPath } from 'node:url'
import addon from '../nativebla.js'
import { mkdir, rm } from 'fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))

// const lorem = new LoremIpsum({
//   sentencesPerParagraph: {
//     max: 8,
//     min: 4,
//   },
//   wordsPerSentence: {
//     max: 16,
//     min: 4,
//   },
// })
// const x = lorem.generateParagraphs(7)
// // const value = Buffer.from(zlib.deflateSync(x))
const relativePath = '/tmp'
const dbFolder = join(__dirname, relativePath)

test.beforeEach('reset db', async () => {
  await rm(dbFolder, { force: true, recursive: true })
  await mkdir(dbFolder).catch(() => {})
  console.log(`Creating db at ${relativePath}`, addon.createDb(relativePath))
})

console.log(addon)

test('set and get single', (t) => {
  const key = Buffer.alloc(20)
  key.write('aaa')
  const value = Buffer.from('sdkfhjjsdlfjksdkjhgfkshgklsdflkjsd')

  addon.set(key, value)
  const res = addon.get(key)
  t.deepEqual(res, value)
})

test.only('set and get batch', (t) => {
  const batch = []
  const batchSize = 100_000
  for (let i = 0; i < batchSize; i++) {
    const key = Buffer.alloc(20)
    key.write(String(i))
    // if (i == 99998) console.log('key = ', key)
    const value = Buffer.from('AMAZINGVALUE' + 1)

    batch.push(key, value)
  }

  addon.setBatch(batch)

  for (let i = 0; i < batch.length; i += 2) {
    try {
      const res = addon.get(batch[i])
      t.deepEqual(res, batch[i + 1])
    } catch (err) {
      console.error(`FAILED AT INDEX ${i}`)
      console.error(batch[i - 2])
      console.error(batch[i])
      throw err
    }
  }
})

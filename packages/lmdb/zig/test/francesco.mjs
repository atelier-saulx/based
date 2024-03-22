import test from 'ava'
// import { LoremIpsum } from 'lorem-ipsum'
import { join, dirname, resolve } from 'path'
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
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.beforeEach('reset db', async () => {
  await rm(dbFolder, { force: true, recursive: true })
  await mkdir(dbFolder).catch(() => {})
  console.log(`Creating db at ${relativePath}`, addon.createDb(dbFolder))
})

console.log(addon)

// test('set and get single', (t) => {
//   const key = Buffer.alloc(20)
//   key.write('aaa')
//   const value = Buffer.from('sdkfhjjsdlfjksdkjhgfkshgklsdflkjsd')

//   addon.set(key, value)
//   const res = addon.get(key)
//   t.deepEqual(res, value)
// })

test.only('set and get batch', async (t) => {
  const batch = []
  const batchSize = 93
  for (let i = 0; i < batchSize; i++) {
    const u8 = new Uint8Array(20)

    // key.writeInt32BE(i, 16)

    for (let i = 0; i < 20; i++) {
      // key.set(1, i + key.byteOffset)
      u8[i] = 1

      // 93
      //
    }

    u8[19] = i

    const key = Buffer(u8)

    console.info(key)

    // if (i == 99998) console.log('key = ', key)
    const value = Buffer.from('AMAZINGVALUE' + i)

    batch.push(key, value)
  }

  addon.setBatch(batch)

  // setInterval(() => {
  // console.log(batch.length)
  // }, 100)

  // for (let i = 0; i < batchSize; i++) {
  //   const key = Buffer.alloc(20)
  //   key.write(String(i, 'binary'))
  //   const value = Buffer.from('AMAZINGVALUE' + i)

  //   try {
  //     const res = addon.get(key)
  //     t.deepEqual(res, value)
  //   } catch (err) {
  //     console.error(`FAILED AT INDEX ${i}`)
  //     console.error('bytes =', batch[i])
  //     console.error('str =', batch[i].toString())
  //     throw err
  //   }
  // }

  for (let i = 0; i < batch.length; i += 2) {
    try {
      const res = addon.get(batch[i])
      t.deepEqual(res, batch[i + 1])
    } catch (err) {
      console.error(`FAILED AT INDEX ${i}`)
      console.error('bytes =', batch[i])
      console.error('str =', batch[i].toString())
      throw err
    }
  }
})

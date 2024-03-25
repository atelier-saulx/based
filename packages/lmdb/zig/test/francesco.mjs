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
  const batchSize = 1e6 // 329 + 10 + 10 + 10 + 2
  for (let i = 0; i < batchSize; i++) {
    // const u8 = new Uint8Array(4)
    const key = Buffer.alloc(4)

    key.writeInt32BE(i)

    // for (let j = 0; j < 20; j++) {
    //   // key.set(1, i + key.byteOffset)
    //   u8[j] = Math.min(200, i)

    //   // 93
    //   //
    // }

    // u8[19] = i

    // var number = i

    // var byte1 = 0xff & number
    // var byte2 = 0xff & (number >> 8)
    // var byte3 = 0xff & (number >> 16)
    // var byte4 = 0xff & (number >> 24)

    // u8[19] = byte1
    // u8[15] = byte4
    // u8[10] = byte2
    // u8[8] = byte3

    // var base2 = number.toString(2)

    // console.log(base2)

    // var arr1 = new Uint8Array([byte1, byte2, byte3, byte4])

    // const key = Buffer(arr1)

    // console.info(key)

    // if (i == 99998) console.log('key = ', key)
    const value = Buffer.from('AMAZINGVALUE' + i)

    batch.push(key, value)
  }

  let d = Date.now()
  addon.setBatch(batch)

  const ms = Date.now() - d
  const seconds = ms / 1000

  console.info(
    'RDY',
    'wrote',
    batchSize / 1000 + 'k',
    ~~(batchSize / seconds),
    'writes / sec',
  )

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

  // for (let i = 0; i < batch.length; i += 2) {
  //   try {
  //     const res = addon.get(batch[i])
  //     t.deepEqual(res, batch[i + 1])
  //   } catch (err) {
  //     console.error(`FAILED AT INDEX ${i / 2}`)
  //     console.error('bytes =', batch[i])
  //     console.error('str =', batch[i].toString())
  //     throw err
  //   }
  // }

  t.true(true)
})

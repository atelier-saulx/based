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
  await rm(dbFolder, { force: true, recursive: true }).catch(() => {})
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

test('set and get batch', async (t) => {
  const batch = []
  const batchSize = 1e6 // 329 + 10 + 10 + 10 + 2
  for (let i = 0; i < batchSize; i++) {
    // const u8 = new Uint8Array(4)
    const key = Buffer.alloc(4)
    key.writeInt32BE(i)

    const value = Buffer.from('AMAZINGVALUE' + i)

    batch.push(key, value)
  }

  let d = Date.now()
  addon.setBatch(batch)

  const ms = Date.now() - d
  const seconds = ms / 1000

  console.info(
    'ARRAY BATCH WRITE',
    'wrote',
    batchSize / 1000 + 'k',
    ~~(batchSize / seconds),
    'writes / sec',
  )

  for (let i = 0; i < batch.length; i += 2) {
    try {
      const res = addon.get(batch[i])
      t.deepEqual(res, batch[i + 1])
    } catch (err) {
      console.error(`FAILED AT INDEX ${i / 2}`)
      console.error('bytes =', batch[i])
      console.error('str =', batch[i].toString())
      throw err
    }
  }

  t.true(true)
})

test('set and get batch with buffers', async (t) => {
  // let buf = Buffer.alloc(0)

  const keys = []
  const values = []
  let totalLen = 0
  const entries = 1e6 // 329 + 10 + 10 + 10 + 2
  for (let i = 0; i < 0 + entries; i++) {
    let key = Buffer.alloc(4)
    key.writeInt32BE(i + 1)
    const value = Buffer.from('AMAZINGVALUE' + i)
    values.push(value)
    keys.push(key)
    totalLen += 2 + value.byteLength + 4
  }

  const buf = Buffer.allocUnsafe(totalLen)

  let prevWritten = 0
  for (let i = 0; i < values.length; i++) {
    // key | size | value
    keys[i].copy(buf, prevWritten)
    prevWritten += 4
    const bla = values[i].byteLength
    buf.writeInt16BE(bla, prevWritten)
    prevWritten += 2
    values[i].copy(buf, prevWritten)
    prevWritten += bla
  }

  // console.log(keys[keys.length - 1])
  // console.log(buf)
  // console.log(buf.toString())

  let d = Date.now()
  const res = addon.setBatchBuffer(buf)

  const ms = Date.now() - d
  const seconds = ms / 1000

  console.info(
    'BUFFER BATCH WRITE',
    'wrote',
    entries / 1000 + 'k',
    ~~(entries / seconds),
    'writes / sec',
  )

  t.is(res, 1)

  for (let i = 0; i < keys.length; i++) {
    try {
      const res = addon.get(keys[i])
      // console.log(keys[i])
      // console.log(values[i].toString())
      // console.log(res.toString())
      t.deepEqual(res, values[i])
    } catch (err) {
      console.error(`FAILED AT INDEX ${i}`)
      console.error('bytes =', values[i])
      console.error('str =', values[i].toString())
      throw err
    }
  }

  t.true(true)
})

test.only('getNoCopy', async (t) => {
  // let buf = Buffer.alloc(0)

  const keys = []
  const values = []
  let totalLen = 0
  const entries = 1e6 // 329 + 10 + 10 + 10 + 2
  for (let i = 0; i < 0 + entries; i++) {
    let key = Buffer.alloc(4)
    key.writeInt32BE(i + 1)
    const value = Buffer.from('AMAZINGVALUE' + i)
    values.push(value)
    keys.push(key)
    totalLen += 2 + value.byteLength + 4
  }

  const buf = Buffer.allocUnsafe(totalLen)

  let prevWritten = 0
  for (let i = 0; i < values.length; i++) {
    // key | size | value
    keys[i].copy(buf, prevWritten)
    prevWritten += 4
    const bla = values[i].byteLength
    buf.writeInt16BE(bla, prevWritten)
    prevWritten += 2
    values[i].copy(buf, prevWritten)
    prevWritten += bla
  }

  // console.log(keys[keys.length - 1])
  // console.log(buf)
  // console.log(buf.toString())

  const res = addon.setBatchBuffer(buf)

  t.is(res, 1, 'setBatch returned 1')

  const gets = []
  let d = Date.now()

  for (let i = 0; i < keys.length; i++) {
    gets.push(addon.getNoCopy(keys[i]))
  }
  const ms = Date.now() - d
  const seconds = ms / 1000

  console.info(
    'NO_COPY GET',
    'read',
    entries / 1000 + 'k',
    'entries in ',
    seconds + ' s,',
    ~~(entries / seconds),
    'reads / sec',
  )

  for (let i = 0; i < keys.length; i++) {
    t.deepEqual(gets[i], values[i])
  }
})

test.only('getBatch', async (t) => {
  // let buf = Buffer.alloc(0)

  const keys = []
  const values = []
  let totalLen = 0
  const entries = 1e6 // 329 + 10 + 10 + 10 + 2
  const get_buffer = Buffer.allocUnsafe(entries * 4)
  for (let i = 0; i < 0 + entries; i++) {
    let key = Buffer.alloc(4)
    key.writeInt32BE(i + 1)
    // console.log('key', i, key)
    const value = Buffer.from('AMAZINGVAL' + i)
    values.push(value)
    keys.push(key)
    totalLen += 2 + value.byteLength + 4
  }

  const set_buffer = Buffer.allocUnsafe(totalLen)

  let prevWritten = 0
  for (let i = 0; i < values.length; i++) {
    // key | size | value
    keys[i].copy(set_buffer, prevWritten)
    keys[i].copy(get_buffer, i * 4)
    // console.log('get_buffer', i, get_buffer)
    prevWritten += 4
    const bla = values[i].byteLength
    set_buffer.writeInt16BE(bla, prevWritten)
    prevWritten += 2
    values[i].copy(set_buffer, prevWritten)
    prevWritten += bla
  }

  // console.log('final get buffer=', get_buffer)
  // console.log(buf)
  // console.log(buf.toString())

  const res = addon.setBatchBuffer(set_buffer)

  t.is(res, 1, 'setBatch returned 1')

  let d = Date.now()

  const get_res = addon.getBatch(get_buffer)
  // console.log('JAVASCRIPT BUFFER = ', get_res)

  const ms = Date.now() - d
  const seconds = ms / 1000

  console.info(
    'BATCH GET',
    'read',
    entries / 1000 + 'k',
    'entries in ',
    seconds + ' s,',
    ~~(entries / seconds),
    'reads / sec',
  )

  let last_read = 0
  for (let i = 0; i < entries; i++) {
    let data_len = get_res.subarray(last_read, last_read + 2).readInt16LE()

    // console.log('data len = ', data_len)

    last_read += 2
    const data = get_res.subarray(last_read, last_read + data_len)
    // console.log('data val = ', data)
    last_read += data_len

    t.deepEqual(data, values[i])
  }
})

test.only('get', async (t) => {
  // let buf = Buffer.alloc(0)

  const keys = []
  const values = []
  let totalLen = 0
  const entries = 1e6 // 329 + 10 + 10 + 10 + 2
  for (let i = 0; i < 0 + entries; i++) {
    let key = Buffer.alloc(4)
    key.writeInt32BE(i + 1)
    const value = Buffer.from('AMAZINGVALUE' + i)
    values.push(value)
    keys.push(key)
    totalLen += 2 + value.byteLength + 4
  }

  const buf = Buffer.allocUnsafe(totalLen)

  let prevWritten = 0
  for (let i = 0; i < values.length; i++) {
    // key | size | value
    keys[i].copy(buf, prevWritten)
    prevWritten += 4
    const bla = values[i].byteLength
    buf.writeInt16BE(bla, prevWritten)
    prevWritten += 2
    values[i].copy(buf, prevWritten)
    prevWritten += bla
  }

  // console.log(keys[keys.length - 1])
  // console.log(buf)
  // console.log(buf.toString())

  const res = addon.setBatchBuffer(buf)

  t.is(res, 1, 'setBatch returned 1')

  const gets = []
  let d = Date.now()

  for (let i = 0; i < keys.length; i++) {
    gets.push(addon.get(keys[i]))
  }
  const ms = Date.now() - d
  const seconds = ms / 1000

  console.info(
    'MEM_COPY GET',
    'read',
    entries / 1000 + 'k',
    'entries in ',
    seconds + ' s,',
    ~~(entries / seconds),
    'reads / sec',
  )

  for (let i = 0; i < keys.length; i++) {
    t.deepEqual(gets[i], values[i])
  }
})

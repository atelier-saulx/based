import test from 'ava'
// import { LoremIpsum } from 'lorem-ipsum'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'node:url'
import addon from '../nativebla.js'
import { mkdir, rm } from 'fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))

const KEY_LEN = 4

const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.beforeEach('reset environment', async () => {
  await rm(dbFolder, { force: true, recursive: true }).catch(() => {})
  await mkdir(dbFolder).catch(() => {})
  console.log(`Creating env at ${relativePath}`, addon.createEnv(dbFolder))
})

console.log(addon)

test('set and get batch with buffers', async (t) => {
  // let buf = Buffer.alloc(0)

  const keys = []
  const values = []
  let totalLen = 0
  const entries = 1e6 // 329 + 10 + 10 + 10 + 2
  // for (let round = 1; round < 3; round++) {
  for (let i = 0; i < 0 + entries; i++) {
    // if (i % round) {
    let key = Buffer.alloc(KEY_LEN)
    key.writeInt32BE(i)
    // key.write('hallo' + String(i))
    const value = Buffer.from('AMAZINGVALUE' + i)
    values.push(value)
    keys.push(key)
    totalLen += 2 + value.byteLength + KEY_LEN
    // }
  }

  const buf = Buffer.allocUnsafe(totalLen)

  let prevWritten = 0
  for (let i = 0; i < values.length; i++) {
    // key | size | value
    keys[i].copy(buf, prevWritten)
    prevWritten += KEY_LEN
    const bla = values[i].byteLength
    buf.writeUInt16LE(bla, prevWritten)
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
    'writes / sec, total',
    seconds + 's',
  )

  t.is(res, 1)
  // }

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

test('getBatch', async (t) => {
  const keys = []
  const values = []
  let totalLen = 0
  const entries = 1e5 // 329 + 10 + 10 + 10 + 2

  const get_buffer = Buffer.allocUnsafe(entries * KEY_LEN)

  for (let i = 0; i < 0 + entries; i++) {
    // if (i % round) {
    let key = Buffer.alloc(KEY_LEN)
    key.writeInt32BE(i)
    key.copy(get_buffer, i * KEY_LEN)
    // key.write('hallo' + String(i))
    const value = Buffer.from('AMAZINGVALUE' + i)
    values.push(value)
    keys.push(key)
    totalLen += 2 + value.byteLength + KEY_LEN
    // }
  }

  const buf = Buffer.allocUnsafe(totalLen)

  let prevWritten = 0
  for (let i = 0; i < values.length; i++) {
    // key | size | value
    keys[i].copy(buf, prevWritten)
    prevWritten += KEY_LEN
    const bla = values[i].byteLength
    buf.writeUInt16LE(bla, prevWritten)
    prevWritten += 2
    values[i].copy(buf, prevWritten)
    prevWritten += bla
  }

  // console.log(keys[keys.length - 1])
  // console.log(buf)
  // console.log(buf.toString())

  const res = addon.setBatchBufferWithDbi(buf)

  t.is(res, 1)

  // const res = addon.setBatchBuffer(set_buffer)

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

    // console.log(data.toString(), values[i].toString())

    t.deepEqual(data, values[i])
  }
})

import test from 'ava'
import addon from '../src/db.js'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'node:url'
import { mkdir, rm } from 'fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))

const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.beforeEach('reset environment', async () => {
  try {
    await rm(resolve(dbFolder, 'data.mdb'))
    await rm(resolve(dbFolder, 'lock.mdb'))
    await rm(dbFolder, { force: true, recursive: true })
  } catch (err) {}
  await mkdir(dbFolder).catch(() => {})
  console.log(`Creating env at ${relativePath}`, addon.createEnv(dbFolder))
})

console.log(addon)

test.serial('set and get with DBI ', async (t) => {
  const KEY_LEN = 8
  const dbiName = Buffer.from('hello\0')

  const keys = []
  const values = []
  let totalLen = 0
  const entries = 1e6 // 329 + 10 + 10 + 10 + 2
  const get_buffer = Buffer.allocUnsafe(entries * KEY_LEN)
  for (let i = 0; i < 0 + entries; i++) {
    let key = Buffer.alloc(KEY_LEN)
    key.writeUInt32LE(i)
    key.copy(get_buffer, i * KEY_LEN)
    const value = Buffer.from('AMAZINGVALUE' + i)
    values.push(value)
    keys.push(key)
    totalLen += 4 + value.byteLength + KEY_LEN
  }

  const buf = Buffer.allocUnsafe(totalLen)

  let prevWritten = 0
  for (let i = 0; i < values.length; i++) {
    // key | size | value
    keys[i].copy(buf, prevWritten)
    prevWritten += KEY_LEN
    const bla = values[i].byteLength
    buf.writeUInt32LE(bla, prevWritten)
    prevWritten += 4
    values[i].copy(buf, prevWritten)
    prevWritten += bla
  }

  let d = Date.now()
  addon.setBatch8(buf, dbiName)

  let ms = Date.now() - d
  let seconds = ms / 1000

  console.info(
    `BATCH WRITE: ${entries / 1000}k entries took ${ms}ms, ${~~(entries / seconds)} sets/second`,
  )

  // t.is(res, 1)

  d = Date.now()
  const get_res = addon.getBatch8(get_buffer, dbiName)
  ms = Date.now() - d
  seconds = ms / 1000

  console.info(
    `BATCH READ: ${entries / 1000}k entries took ${ms}ms, ${~~(entries / seconds)} gets/second`,
  )

  let last_read = 0
  for (let i = 0; i < entries; i++) {
    let data_len = get_res.subarray(last_read, last_read + 4).readInt32LE()

    // console.log('data len = ', data_len)

    last_read += 4
    const data = get_res.subarray(last_read, last_read + data_len)
    // console.log('data val = ', data)
    last_read += data_len

    // console.log(data.toString(), values[i].toString())

    t.deepEqual(data, values[i])
  }
})

test.serial('get from non existing dbi', (t) => {
  const KEY_LEN = 8
  const dbiName = Buffer.from('I dont exist\0')

  const getBuffer = Buffer.alloc(KEY_LEN)
  getBuffer.writeUint32LE(555)

  // t.is(res, 1)

  try {
    const res1 = addon.getBatch8(getBuffer, dbiName)
    t.is(res1, undefined)
  } catch (_e) {}

  const keys = []
  const values = []
  let totalLen = 0
  const entries = 1e6 // 329 + 10 + 10 + 10 + 2
  const get_buffer = Buffer.allocUnsafe(entries * KEY_LEN)
  for (let i = 0; i < 0 + entries; i++) {
    let key = Buffer.alloc(KEY_LEN)
    key.writeUInt32LE(i)
    key.copy(get_buffer, i * KEY_LEN)
    const value = Buffer.from('AMAZINGVALUE' + i)
    values.push(value)
    keys.push(key)
    totalLen += 4 + value.byteLength + KEY_LEN
  }

  const buf = Buffer.allocUnsafe(totalLen)

  let prevWritten = 0
  for (let i = 0; i < values.length; i++) {
    // key | size | value
    keys[i].copy(buf, prevWritten)
    prevWritten += KEY_LEN
    const bla = values[i].byteLength
    buf.writeUInt32LE(bla, prevWritten)
    prevWritten += 4
    values[i].copy(buf, prevWritten)
    prevWritten += bla
  }

  let d = Date.now()
  addon.setBatch8(buf, dbiName)

  let ms = Date.now() - d
  let seconds = ms / 1000

  console.info(
    `BATCH WRITE: ${entries / 1000}k entries took ${ms}ms, ${~~(entries / seconds)} sets/second`,
  )

  // t.is(res, 1)

  d = Date.now()
  const get_res = addon.getBatch8(get_buffer, dbiName)
  ms = Date.now() - d
  seconds = ms / 1000

  console.info(
    `BATCH READ: ${entries / 1000}k entries took ${ms}ms, ${~~(entries / seconds)} gets/second`,
  )

  let last_read = 0
  for (let i = 0; i < entries; i++) {
    let data_len = get_res.subarray(last_read, last_read + 4).readInt32LE()

    // console.log('data len = ', data_len)

    last_read += 4
    const data = get_res.subarray(last_read, last_read + data_len)
    // console.log('data val = ', data)
    last_read += data_len

    // console.log(data.toString(), values[i].toString())

    t.deepEqual(data, values[i])
  }
})

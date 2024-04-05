import test from 'ava'
// import { LoremIpsum } from 'lorem-ipsum'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'node:url'
import addon from '../nativebla.js'
import { mkdir, rm } from 'fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))

const KEY_LEN = 8

const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.beforeEach('reset environment', async () => {
  await rm(dbFolder, { force: true, recursive: true }).catch(() => {})
  await mkdir(dbFolder).catch(() => {})
  console.log(`Creating env at ${relativePath}`, addon.createEnv(dbFolder))
})

console.log(addon)

test.serial('set and get batch with buffers', async (t) => {
  // let buf = Buffer.alloc(0)

  const keys = []
  const values = []
  let totalLen = 0
  const entries = 1e6 // 329 + 10 + 10 + 10 + 2
  const get_buffer = Buffer.allocUnsafe(entries * KEY_LEN)
  const dx = Date.now()
  for (let i = 0; i < 0 + entries; i++) {
    let key = Buffer.alloc(KEY_LEN)
    key.writeUint32LE(i)

    // key.writeBigUInt64LE(BigInt(i))
    key.copy(get_buffer, i * KEY_LEN)
    const value = Buffer.from('AMAZINGVALUE' + i)
    values.push(value)
    keys.push(key)
    totalLen += 2 + value.byteLength + KEY_LEN
  }
  console.log('flap', Date.now() - dx, 'ms')

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

  let d = Date.now()
  const res = addon.setBatchBuffer(buf)

  let ms = Date.now() - d
  let seconds = ms / 1000

  console.info(
    `BATCH WRITE: ${entries / 1000}k entries took ${ms}ms, ${~~(entries / seconds)} sets/second`,
  )

  t.is(res, 1)

  d = Date.now()
  const get_res = addon.getBatch(get_buffer)
  ms = Date.now() - d
  seconds = ms / 1000

  console.info(
    `BATCH READ: ${entries / 1000}k entries took ${ms}ms, ${~~(entries / seconds)} gets/second`,
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

test.serial('set and get batch with buffers', async (t) => {
  // let buf = Buffer.alloc(0)

  const keys = []
  const values = []
  let totalLen = 0
  const entries = 1e6 // 329 + 10 + 10 + 10 + 2
  const get_buffer = Buffer.allocUnsafe(entries * KEY_LEN)
  const dx = Date.now()
  for (let i = 0; i < 0 + entries; i++) {
    let key = Buffer.alloc(KEY_LEN)
    key.writeUint32LE(i)

    // key.writeBigUInt64LE(BigInt(i))
    key.copy(get_buffer, i * KEY_LEN)
    const value = Buffer.from('AMAZINGVALUE' + i)
    values.push(value)
    keys.push(key)
    totalLen += 2 + value.byteLength + KEY_LEN
  }
  console.log('flap', Date.now() - dx, 'ms')

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

  let d = Date.now()
  const res = addon.setBatchBuffer(buf)

  let ms = Date.now() - d
  let seconds = ms / 1000

  console.info(
    `BATCH WRITE: ${entries / 1000}k entries took ${ms}ms, ${~~(entries / seconds)} sets/second`,
  )

  t.is(res, 1)

  d = Date.now()
  const get_res = addon.getBatch(get_buffer)
  ms = Date.now() - d
  seconds = ms / 1000

  console.info(
    `BATCH READ: ${entries / 1000}k entries took ${ms}ms, ${~~(entries / seconds)} gets/second`,
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

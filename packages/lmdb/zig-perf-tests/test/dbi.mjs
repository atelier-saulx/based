import test from 'ava'
// import { LoremIpsum } from 'lorem-ipsum'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'node:url'
import addon from '../nativebla.js'
import { mkdir, rm, stat } from 'fs/promises'
import { wait } from '@saulx/utils'

const __dirname = dirname(fileURLToPath(import.meta.url))

const KEY_LEN = 4
const DBIs = 100000
const entries = 1e6

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

test.serial.skip('set and get batch with buffers single DBI', async (t) => {
  // let buf = Buffer.alloc(0)

  console.log('======= single dbi')

  const setTimes = []
  var setTotalTime = 0
  const getTimes = []
  var getTotalTime = 0

  const keys = []
  const values = []
  let totalLen = 0
  for (let dbi_index = 0; dbi_index < DBIs; dbi_index++) {
    const get_buffer = Buffer.allocUnsafe(entries * KEY_LEN)

    for (let i = 0; i < 0 + entries; i++) {
      // if (i % round) {
      let key = Buffer.alloc(KEY_LEN)
      key.writeInt32LE(i)
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
    let d = Date.now()
    const res = addon.setBatchBuffer(buf)

    let ms = Date.now() - d
    setTimes.push(ms)
    setTotalTime += ms

    t.is(res, 1)

    // const res = addon.setBatchBuffer(set_buffer)

    t.is(res, 1, 'setBatch returned 1')

    d = Date.now()

    const get_res = addon.getBatch(get_buffer)
    // console.log('JAVASCRIPT BUFFER = ', get_res)

    ms = Date.now() - d

    getTimes.push(ms)
    getTotalTime += ms

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
    if (!(dbi_index % 500)) console.log(`step ${dbi_index}/${DBIs}`)
  }
  setTimes.sort((a, b) => a - b)
  getTimes.sort((a, b) => a - b)

  console.log('SINGLE DBI=')
  console.log(
    `sets: ${DBIs} sets of ${entries} (${DBIs * entries} total nodes) entries, total: ${setTotalTime / 1000}s, avg: ${setTotalTime / setTimes.length}ms, high: ${setTimes[setTimes.length - 1]}ms, low: ${setTimes[0]}ms`,
  )
  console.log(
    `gets: ${DBIs} gets of ${entries} (${DBIs * entries} total nodes) entries, total: ${getTotalTime / 1000}s, avg: ${getTotalTime / getTimes.length}ms, high: ${getTimes[getTimes.length - 1]}ms, low: ${getTimes[0]}ms`,
  )
})

test.serial('set and get batch with buffers MANY DBIs', async (t) => {
  // let buf = Buffer.alloc(0)
  console.log('======= many dbis')

  const setTimes = []
  var setTotalTime = 0
  const getTimes = []
  var getTotalTime = 0

  const keys = []
  const values = []
  let totalLen = 0

  const get_buffer = Buffer.allocUnsafe(KEY_LEN * entries)

  for (let i = 0; i < 0 + entries; i++) {
    let key = Buffer.alloc(KEY_LEN)
    key.writeInt32LE(i)
    key.copy(get_buffer, i * KEY_LEN)
    const value = Buffer.from('AMAZINGVALUE' + i)
    values.push(value)
    keys.push(key)
    totalLen += 2 + value.byteLength + KEY_LEN
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

  for (let dbi_index = 1; dbi_index < DBIs + 1; dbi_index++) {
    const dbiName = Buffer.from(dbi_index + '\0')

    let d = Date.now()
    const res = addon.setBatchBuffer(buf, dbiName)

    let ms = Date.now() - d
    setTimes.push(ms)
    setTotalTime += ms
    // const res = addon.setBatchBuffer(set_buffer)
    const blaMs = ms

    t.is(res, 1, 'setBatch returned 1')

    d = Date.now()

    buf

    const get_res = addon.getBatch(get_buffer, dbiName)

    ms = Date.now() - d

    console.log(`step ${dbi_index}/${DBIs} DBI  SET 1M ${blaMs}ms, GET ${ms}ms`)

    // await wait(1e3)

    // getTimes.push(ms)
    // getTotalTime += ms

    // let last_read = 0

    // for (let i = 0; i < entries; i++) {
    //   let data_len = get_res.subarray(last_read, last_read + 2).readInt16LE()

    //   // console.log('data len = ', data_len)

    //   last_read += 2
    //   const data = get_res.subarray(last_read, last_read + data_len)
    //   // console.log('data val = ', data)
    //   last_read += data_len

    //   // console.log(data.toString(), values[i].toString())

    //   t.deepEqual(data, values[i])
    // }
  }
  setTimes.sort((a, b) => a - b)
  getTimes.sort((a, b) => a - b)

  console.log(DBIs, 'DBIs')

  console.log(
    `sets: ${DBIs} sets of ${entries} (${DBIs * entries} total nodes) entries, total: ${setTotalTime / 1000}s, avg: ${setTotalTime / setTimes.length}ms, high: ${setTimes[setTimes.length - 1]}ms, low: ${setTimes[0]}ms`,
  )
  console.log(
    `gets: ${DBIs} gets of ${entries} (${DBIs * entries} total nodes) entries, total: ${getTotalTime / 1000}s, avg: ${getTotalTime / getTimes.length}ms, high: ${getTimes[getTimes.length - 1]}ms, low: ${getTimes[0]}ms`,
  )

  // let buf = Buffer.alloc(0)
  const bla = () => {
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
      totalLen += 2 + value.byteLength + KEY_LEN
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
  }

  t.true(true)

  // bla()
})
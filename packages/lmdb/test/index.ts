import test from 'ava'
import lmdb from 'node-lmdb'
import { setByPath, wait } from '@saulx/utils'
import { Worker } from 'node:worker_threads'
import { dirname } from 'node:path'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import zlib from 'node:zlib'
import { BasedSchemaFieldType } from '@based/schema'
import { compile, createRecord } from 'data-record'
// defs
// import { createRecord, } from 'data-record'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const d = dirname(fileURLToPath(import.meta.url))

const amount = 1000
const rounds = 1

const worker = (i: number) => {
  return new Promise((resolve) => {
    const wrk = new Worker(d + '/writerman.js', {
      workerData: { i, amount, rounds },
    })
    wrk.on('message', (d) => {
      resolve(0)
      wrk.terminate()
    })
  })
}

// const recordDef = [
//   { name: 'a', type: 'uint32_le' },
//   // { name: 'name', type: 'cstring', size: 15 },
//   { name: 'values', type: 'record_p' },
//   { name: 'more', type: 'cstring_p' },
// ]

test('create server', async (t) => {
  const d = Date.now()

  try {
    await fs.rmdir(__dirname + '/tmp', { recursive: true })
  } catch (err) {}
  await fs.mkdir(__dirname + '/tmp')

  // const q = []
  // for (let i = 0; i < 10; i++) {
  //   q.push(worker(i))
  // }

  // await Promise.all(q)

  console.log(
    Date.now() - d,
    'ms',
    `did ${(amount * rounds * 10) / 1000}k writes`,
  )

  // ------------- READ ---------------
  console.log('start reading...')
  var env = new lmdb.Env()
  env.open({
    path: __dirname + '/tmp',
    mapSize: 100 * 1024 * 1024 * 1024, // maximum database size
    maxDbs: 3,
  })

  const dbi = env.openDbi({
    name: 'myPrettyDatabase',
    create: true, // will create if database did not exist
  })

  // var txn = env.beginTxn()

  // var cursor = new lmdb.Cursor(txn, dbi)
  // // var cursor = new lmdb.Cursor(txn, dbi, { keyIsBuffer: true })

  // var xx = cursor.goToFirst()

  // console.log('---> KEY FIRST', xx)

  // let match = 0

  // const arr = Buffer.from(new Uint8Array([1, 2, 3, 4, 5]))

  // const word = 'Lorem'

  // let lastValue
  // let i = 0
  // let d2 = Date.now()
  // for (
  //   var found = cursor.goToFirst();
  //   found !== null;
  //   found = cursor.goToNext()
  // ) {
  //   lastValue = cursor.getCurrentBinary()

  //   // if (lastValue.byteLength > 100) {
  //   //   if (zlib.inflateSync(lastValue).includes(word)) {
  //   //     match++
  //   //   }
  //   // } else {

  //   // starts with

  //   if (lastValue.equals(arr)) {
  //     match++
  //   }
  //   // }

  //   // buf1.equals(buf2);
  //   // if (lastValue > 4) {
  //   //   match++
  //   // }

  //   i++
  //   // console.info({ i, found })
  //   // Here 'found' contains the key, and you can get the data with eg. getCurrentString/getCurrentBinary etc.
  //   // ...
  // }

  // 0a

  // console.info(
  //   Date.now() - d2,
  //   'ms',
  //   'read',
  //   i / 1000,
  //   'k',
  //   'keys',
  //   match,
  //   'match',
  // )
  // console.info('last value', lastValue)

  // const buff = cursor.getCurrentBinaryUnsafe()

  // console.info(buff)

  // cursor.close()
  // txn.commit()

  const lenMap = {
    timestamp: 8, // 64bit
    number: 8, // 64bit
    integer: 4, // 32bit Unisgned 4
    boolean: 1, // 1bit (bit overhead)
    // double-precision 64-bit binary format IEEE 754 value
    // means put in own
    string: 0,
  }

  const convertSchemaToProto = (
    type: any,
    result: any = {
      _cnt: 0,
      fields: {},
      dbMap: {
        _len: 0,
        tree: {},
        dataRecordDef: [],
      },
    },
    path: string[] = [],
    top: boolean = true,
  ) => {
    let target: any
    if (type.fields) {
      target = type.fields
    } else if (type.properties) {
      target = type.properties
    }

    for (const key in target) {
      const f = target[key]
      const p = [...path, key]
      if (f.type === 'object') {
        convertSchemaToProto(f, result, p, false)
      } else {
        result.fields[p.join('.')] = {
          __sValue: true,
          type: f.type,
          path: p,
          len: lenMap[f.type],
        }
        result._cnt++
      }
    }

    if (top) {
      const vals: any = Object.values(result.fields)

      vals.sort((a: any, b: any) => {
        if (!a.type) {
          return -1
        }
        return a.type === 'timestamp' || a.type === 'number' ? -1 : 1
      })

      let i = 0
      for (const f of vals) {
        f.index = i
        i++

        result.dbMap.dataRecordDef.push({
          name: f.index,
          type:
            f.type === 'integer'
              ? 'uint32_le'
              : f.type === 'timestamp'
                ? 'double_le'
                : f.type === 'number'
                  ? 'double_le'
                  : f.type === 'boolean'
                    ? 'uint8'
                    : f.type === 'string'
                      ? 'cstring_p'
                      : '????',
        })

        const len = f.len
        if (len) {
          if (!result.dbMap._) {
            result.dbMap._ = []
          }
          f.start = result.dbMap._len
          result.dbMap._len += len
          result.dbMap._.push(f)
          f.seperate = false
          setByPath(result.dbMap.tree, f.path, f)
        } else {
          setByPath(result.dbMap.tree, f.path, f)
          f.start = 0
          f.seperate = true
          result.dbMap[f.index] = f
        }
      }

      result.dbMap.record = compile(result.dbMap.dataRecordDef)

      console.log(result.dbMap.record)
      console.dir(Object.keys(result.dbMap), { depth: 10 })
      console.log(result.dbMap._.map((v) => v.path))
    }

    return result
  }

  const storeUint = (buff: Uint8Array, n: number, start: number) => {
    buff[start] = (n >> 24) & 0xff
    buff[start + 1] = (n >> 16) & 0xff
    buff[start + 2] = (n >> 8) & 0xff
    buff[start + 3] = n & 0xff
  }

  const readUint = (buff: Uint8Array, start: number): number => {
    return (
      ((buff[start] << 24) |
        (buff[start + 1] << 16) |
        (buff[start + 2] << 8) |
        buff[start + 3]) >>>
      0
    )
  }

  type View = { view?: DataView; arr?: Uint8Array; resul?: any }

  const writeFromSetObj = (obj, tree, schema, view: View) => {
    for (const key in obj) {
      const t = tree[key]
      const value = obj[key]
      if (typeof value === 'object') {
        writeFromSetObj(value, t, schema, view)
      } else {
        // if (t.type === 'timestamp') {
        //   view.result[t.index] = BigInt(value)
        // } else {
        // view.result[t.index] = value
        // }
        if (t.type === 'timestamp' || t.type === 'number') {
          if (!view.view) {
            view.view = new DataView(view.arr.buffer)
          }
          view.view.setFloat64(t.start, value)
        } else if (t.type === 'integer') {
          if (view.view) {
            view.view.setUint32(t.start, value)
          } else {
            storeUint(view.arr, value, t.start)
          }
        } else if (t.type === 'boolean') {
          view.arr[t.start] = value ? 1 : 0
        }
      }
    }
  }

  const readFromBuffer = (view: View, tree: any): any => {
    const obj = {}
    for (const key in tree) {
      const t = tree[key]
      if (t.type === 'boolean') {
        obj[key] = view.arr[t.start] ? true : false
      } else if (t.type === 'number' || t.type === 'timestamp') {
        if (!view.view) {
          view.view = new DataView(view.arr.buffer)
        }
        obj[key] = view.view.getFloat64(t.start)
      } else if (t.type === 'string') {
      } else if (t.type === 'integer') {
        if (view.view) {
          obj[key] = view.view.getUint32(t.start)
        } else {
          obj[key] = readUint(view.arr, t.start)
        }
      } else {
        obj[key] = readFromBuffer(view, tree[key])
      }
    }
    return obj
  }

  // just use buffer sadnass
  const set = (obj, schema, buf?: Buffer) => {
    let arr
    if (!buf) {
      arr = new Uint8Array(schema.dbMap._len)
    } else {
      // use buff offset
    }
    // const result = {}

    // preAllocated

    writeFromSetObj(obj, schema.dbMap.tree, schema, { arr })

    // return createRecord(schema.dbMap.record, result)

    return arr
  }

  const get = (arr: Uint8Array, schema) => {
    return readFromBuffer({ arr }, schema.dbMap.tree)
  }

  // redesign as well
  const complex: any = {
    fields: {
      flap: {
        type: 'integer',
      },
      value: {
        type: 'integer',
      },
      nip: {
        type: 'string',
      },
      mep: {
        type: 'number',
      },
      created: {
        type: 'timestamp',
      },
      updated: {
        type: 'timestamp',
      },
      snurp: {
        type: 'object',
        properties: {
          derp: { type: 'integer' },
          bla: { type: 'string' },
          hup: {
            type: 'object',
            properties: {
              start: {
                type: 'timestamp',
              },
              x: { type: 'integer' },
              isDope: { type: 'boolean' },
            },
          },
        },
      },
    },
  }

  const vote: any = {
    fields: {
      vectorClock: { type: 'integer' },
      value: {
        type: 'integer',
      },
    },
  }

  // const schemaField = convertSchemaToProto(complex)

  // console.dir(schemaField, { depth: 10 })

  const schemaField = convertSchemaToProto(vote)

  // const setObj = {
  //   flap: 12,
  //   updated: Date.now(),
  //   created: Date.now(),
  //   mep: 10.2311,
  //   snurp: { derp: 100, hup: { isDope: true, x: 1 } },
  // }

  const setObj = {
    value: 1e3,
    // update: Date.now(),
  }

  const buf = set(setObj, schemaField)
  console.log('set', setObj, buf)
  console.log('read', get(buf, schemaField))

  const write = (writes) => {
    return new Promise((resolve, reject) => {
      env.batchWrite(
        writes,
        // @ts-ignore
        //   { keyIsBuffer: true },
        (error, results) => {
          if (error) {
            console.error(error)
            reject(error)
          } else {
            resolve(results)
          }
        },
      )
    })
  }

  const updated = Date.now()
  const created = Date.now()

  const dSet = Date.now()
  const writes: any = []
  for (let i = 0; i < 1e6; i++) {
    // set(
    //   {
    //     // flap: i,
    //     // updated,
    //     value: i,
    //     // created,
    //     // mep: i * 100,
    //     // snurp: { derp: 100, hup: { isDope: true, x: 1 } },
    //   },
    //   schemaField,
    // )

    writes.push([
      dbi,
      i + 'a',
      set(
        {
          // {
          //   flap: i,
          //   updated,
          value: i,
          vectorClock: i,
          // created,
          // mep: i * 100,
          // snurp: { derp: 100, hup: { isDope: true, x: 1 } },
        },
        schemaField,
      ),
    ])
  }
  await write(writes)
  console.log('gen buf 1 mil times', Date.now() - dSet, 'ms')

  const dGet = Date.now()

  // for (let i = 0; i < 1e6; i++) {
  //   get(buf, schemaField)
  // }

  const xxx: any = []
  var txn = env.beginTxn()
  var cursor = new lmdb.Cursor(txn, dbi)
  cursor.goToFirst()
  for (
    var found = cursor.goToFirst();
    found !== null;
    found = cursor.goToNext()
  ) {
    xxx.push(get(cursor.getCurrentBinary(), schemaField))
  }

  console.log('read 1 mil times', Date.now() - dGet, 'ms')

  console.info('HELLO DONE')

  await wait(1e3)
  dbi.close()
  env.close()

  t.pass()
})

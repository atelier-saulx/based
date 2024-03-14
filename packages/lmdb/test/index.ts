import test from 'ava'
import lmdb from 'node-lmdb'
import { setByPath, wait } from '@saulx/utils'
import { Worker } from 'node:worker_threads'
import { dirname } from 'node:path'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import zlib from 'node:zlib'
import { BasedSchemaFieldType } from '@based/schema'

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

test('create server', async (t) => {
  const d = Date.now()

  try {
    await fs.rmdir(__dirname + '/tmp', { recursive: true })
  } catch (err) {}
  await fs.mkdir(__dirname + '/tmp')

  const q = []
  for (let i = 0; i < 10; i++) {
    q.push(worker(i))
  }

  await Promise.all(q)

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

  var txn = env.beginTxn()

  var cursor = new lmdb.Cursor(txn, dbi)
  // var cursor = new lmdb.Cursor(txn, dbi, { keyIsBuffer: true })

  var xx = cursor.goToFirst()

  console.log('---> KEY FIRST', xx)

  let match = 0

  const arr = Buffer.from(new Uint8Array([1, 2, 3, 4, 5]))

  const word = 'Lorem'

  let lastValue
  let i = 0
  let d2 = Date.now()
  for (
    var found = cursor.goToFirst();
    found !== null;
    found = cursor.goToNext()
  ) {
    lastValue = cursor.getCurrentBinary()

    // if (lastValue.byteLength > 100) {
    //   if (zlib.inflateSync(lastValue).includes(word)) {
    //     match++
    //   }
    // } else {

    // starts with

    if (lastValue.equals(arr)) {
      match++
    }
    // }

    // buf1.equals(buf2);
    // if (lastValue > 4) {
    //   match++
    // }

    i++
    // console.info({ i, found })
    // Here 'found' contains the key, and you can get the data with eg. getCurrentString/getCurrentBinary etc.
    // ...
  }

  // 0a

  console.info(
    Date.now() - d2,
    'ms',
    'read',
    i / 1000,
    'k',
    'keys',
    match,
    'match',
  )
  console.info('last value', lastValue)

  const buff = cursor.getCurrentBinaryUnsafe()

  console.info(buff)

  cursor.close()
  txn.commit()

  const lenMap = {
    integer: 4, // 32bit
    boolean: 1, // 1bit (bit overhead)
    // double-precision 64-bit binary format IEEE 754 value
    number: 8, // 64bit
    // means put in own
    string: 0,
  }

  // redesign as well
  const type: any = {
    fields: {
      flap: {
        type: 'integer',
      },
      nip: {
        type: 'string',
      },
      mep: {
        type: 'number',
      },
      snurp: {
        type: 'object',
        properties: {
          derp: { type: 'integer' },
          bla: { type: 'string' },
          hup: {
            type: 'object',
            properties: {
              x: { type: 'integer' },
              isDope: { type: 'boolean' },
            },
          },
        },
      },
    },
  }

  const convertSchemaToProto = (
    type: any,
    result: any = {
      _cnt: 0,
      fields: {},
      dbMap: {
        _len: 0,
        tree: {},
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
          index: result._cnt,
          type: f.type,
          path: p,
        }
        result._cnt++
      }
    }

    if (top) {
      for (const key in result.fields) {
        const f = result.fields[key]
        const len = lenMap[f.type]
        if (len) {
          if (!result.dbMap._) {
            result.dbMap._ = []
          }
          result.dbMap._len += len
          result.dbMap._.push(f)
          setByPath(result.dbMap.tree, f.path, [f.index, 0])
        } else {
          setByPath(result.dbMap.tree, f.path, [f.index, 1])
          result.dbMap[f.index] = f
        }
      }
    }

    return result
  }

  // unsafe prob

  const walkObj = (obj, tree, schema, arr: Uint8Array) => {
    for (const key in obj) {
      const t = tree[key]
      const o = obj[key]
      if (typeof o === 'object') {
        walkObj(o, t, schema, arr)
      } else {
        console.log('write', t)
      }
    }
  }

  const genSetId = (obj, schema, buf?: Buffer) => {
    let arr
    if (!buf) {
      arr = new Uint8Array(schema.dbMap._len)
    }

    walkObj(obj, schema.tree, schema, arr)

    // const buf = Buffer.allocUnsafe(10);

    return Buffer.from(arr)
  }

  const schemaField = convertSchemaToProto(type)

  console.dir(schemaField, { depth: 10 })

  console.dir(
    'set',
    genSetId(
      {
        flap: 12,
        snurp: { derp: 100, hup: { isDope: true, x: 1 } },
      },
      schemaField,
    ),
  )

  console.info('HELLO DONE')

  await wait(1e3)
  dbi.close()
  env.close()

  t.pass()
})

import test from 'ava'
import lmdb from 'node-lmdb'
import { wait } from '@saulx/utils'
import { Worker } from 'node:worker_threads'
import { dirname } from 'node:path'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { createSchemaTypeDef, createBuffer, parseBuffer } from '../src/index.js'
import { compile, createRecord } from 'data-record'

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

  const schemaField = createSchemaTypeDef(vote)

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

  const buf = createBuffer(setObj, schemaField)
  console.log('set', setObj, buf)
  console.log('read', parseBuffer(buf, schemaField))

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
      createBuffer(
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
    xxx.push(parseBuffer(cursor.getCurrentBinary(), schemaField))
  }

  console.log('read 1 mil times', Date.now() - dGet, 'ms')

  console.info('HELLO DONE')

  await wait(1e3)
  dbi.close()
  env.close()

  t.pass()
})

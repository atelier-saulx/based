import test from 'ava'
import lmdb from 'node-lmdb'
import { wait } from '@saulx/utils'
import { Worker } from 'node:worker_threads'
import { dirname } from 'node:path'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const d = dirname(fileURLToPath(import.meta.url))

const amount = 1000
const rounds = 200

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

  let lastValue
  let i = 0
  let d2 = Date.now()
  for (
    var found = cursor.goToFirst();
    found !== null;
    found = cursor.goToNext()
  ) {
    lastValue = cursor.getCurrentBinary()
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

  // 60 bytes
  // 5 bytes

  console.info('HELLO DONE')

  await wait(1e3)
  dbi.close()
  env.close()

  t.pass()
})

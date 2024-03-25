import zlib from 'node:zlib'
import { LoremIpsum } from 'lorem-ipsum'
import fs from 'fs/promises'
import { join, dirname } from 'path'
import assert from 'node:assert'
import { fileURLToPath } from 'node:url'
import addon from './nativebla.js'
import { BasedServer } from '@based/server'
import { Worker } from 'node:worker_threads'
import { write } from 'node:fs'
import { wait } from '@saulx/utils'

const __dirname = dirname(fileURLToPath(import.meta.url))

// console.log(LoremIpsum)

const tmpF = join(__dirname, '/tmp')

const lorem = new LoremIpsum({
  sentencesPerParagraph: {
    max: 8,
    min: 4,
  },
  wordsPerSentence: {
    max: 16,
    min: 4,
  },
})
const x = lorem.generateParagraphs(7)
// const value = Buffer.from(zlib.deflateSync(x))

console.log(addon)

console.log('go create db...', addon.createDb('./tmp'))

const key = Buffer.alloc(20)
key.write('aaa')
console.log('key=\t', key)

const value = Buffer.from('sdkfhjjsdlfjksdkjhgfkshgklsdflkjsd')
console.log('value=\t', value)
addon.set(key, value)
const res = addon.get(key)
console.log('\nexpected =\t', value)
console.log('actual =\t', res)
assert(Buffer.compare(value, res) == 0)

// let total = 0

// const n = 2

// const bla = async () => {
//   // rm tmp
//   for (let j = 0; j < n; j++) {
//     let i = 0

//     await fs.rmdir(tmpF).catch(() => {})
//     await fs.mkdir(tmpF).catch(() => {})

//     for (i; i < 3; i++) {
//       const key = Buffer.from('a' + i)

//       const value = []
//       const d = global.performance.now()
//       // slow creates multiple transactions...
//       for (let i = 0; i < 1e5; i++) {
//         value.push('b' + i, 'poopie ' + i)
//       }

//       addon.setBatch(value)

//       total += global.performance.now() - d
//       console.log('total wrote = ', i, global.performance.now() - d, 'ns')
//     }

//     // }

//     // console.log('wrote ', i, Date.now() - d, 'ms')
//     // }
//   }
// }

const value2 = Buffer.from('sdkfhjjsdlfjksdkjhgfkshgklsdflkjsd')

const doworker = (data) =>
  new Promise((resolve) => {
    const x = new Worker(join(__dirname, './test-flap.mjs'), { data })
    x.on('message', (msg) => {
      if (msg === 'done') {
        x.terminate()
        resolve(x)
      }
    })
  })

// const run = async () => {
//   await fs.rmdir(tmpF).catch(() => {})
//   await fs.mkdir(tmpF).catch(() => {})

//   const batchTime = Date.now()
//   const batch = []
//   let y = 0
//   for (y; y < 1_000_000; y++) {
//     // const key =
//     batch.push(Buffer.from('derp' + y), value2)
//     // batch.push(value)
//   }

//   addon.setBatch(batch)
//   console.log(`batch writing ${y} nodes took`, Date.now() - batchTime, 'ms')
// }

const wrker = new Worker(join(__dirname, './db.mjs'))

let writes = []
let isDraining = false
let inProgress = false
const drain = () => {
  if (!isDraining) {
    isDraining = true
    setTimeout(() => {
      isDraining = false

      if (!inProgress) {
        let w
        console.log('DRAIN', writes.length)
        const DRAIN = 2e6
        if (writes.length > DRAIN) {
          w = writes.splice(DRAIN, DRAIN)
          // isDraining = true
        } else {
          w = writes
          writes = []
        }
        inProgress = true
        wrker.postMessage(w)
        wrker.once('message', () => {
          inProgress = false
          if (writes.length) {
            drain()
          }
        })
      }

      // addon.setBatch(w)
    }, 0)
  }
}

let cnt = 0
let s = 0

const server = new BasedServer({
  port: 9910,
  // auth: {
  //   authorize: async () => true,
  // },
  functions: {
    configs: {
      hello: {
        type: 'function',
        maxPayloadSize: 1e9,
        rateLimitTokens: 0,
        fn: async (_, payload) => {
          if (!s) {
            s = Date.now()
          }

          // console.log(payload)

          // console.log(payload)
          //Buffer.from(payload.value)

          for (let i = 0; i < payload.writes.length; i += 2) {
            const w = payload.writes

            const key = Buffer.alloc(4)

            key.writeInt32BE(w[i])

            // Buffer.from(w[i])
            writes.push(key, Buffer.from(w[i + 1]))
            // writes.push(w[i] + '1', Buffer.from(''))
            // writes.push(w[i] + '0', Buffer.from(''))
            cnt++
          }
          drain()
          return 1
        },
      },
    },
  },
})

const runIt = async () => {
  await server.start()
  await fs.rmdir(tmpF, { recursive: true }).catch((err) => {
    console.error(err)
  })
  await fs.mkdir(tmpF).catch(() => {})

  console.log('go create db...', addon.createDb('./tmp'))

  const key = Buffer.alloc(20)
  key.write('aaa')
  console.log('key=\t', key)

  const value = Buffer.from('sdkfhjjsdlfjksdkjhgfkshgklsdflkjsd')
  console.log('value=\t', value)
  addon.set(key, value)

  await wait(100)

  const q = []
  for (let i = 0; i < 5; i++) {
    q.push(doworker(i))
  }
  await Promise.all(q)

  const done = () =>
    new Promise((resolve) => {
      let interval = setInterval(() => {
        // console.log(writes.length)
        if (writes.length === 0) {
          clearInterval(interval)
          resolve()
        }
      }, 0)
    })

  await done()

  const ms = Date.now() - s
  const seconds = ms / 1000

  await wait(2250)

  const mb = (await fs.stat(join(tmpF, 'data.mdb'))).size / 1000 / 1000

  console.info(
    'RDY',
    'wrote',
    cnt / 1000 + 'k',
    ~~(cnt / seconds),
    'writes / sec',
    ms,
    'ms',
    'wrote to disk',
    ~~mb,
    'mb',

    ~~(mb / seconds),
    'mb / sec',
  )
}

runIt()

// run()

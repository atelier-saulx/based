import lmdb from 'node-lmdb'
import { parentPort, workerData } from 'node:worker_threads'
import zlib from 'node:zlib'
import { LoremIpsum } from 'lorem-ipsum'
import { dirname } from 'node:path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

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

const write = (writes) => {
  return new Promise((resolve, reject) => {
    env.batchWrite(
      writes,
      // @ts-ignore
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

const x = lorem.generateParagraphs(7)
const data = zlib.deflateSync(x)

let tx = 0

for (let i = 0; i < workerData.rounds; i++) {
  const writes = []
  for (let j = 0; j < workerData.amount; j++) {
    tx =
      i * workerData.amount +
      j +
      workerData.i * (workerData.rounds * workerData.amount)
    writes.push([dbi, tx + 'a', new Uint8Array([0])])
  }
  await write(writes)
}

parentPort.postMessage('done!')

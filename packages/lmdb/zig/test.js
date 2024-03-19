const zlib = require('node:zlib')
const { LoremIpsum } = require('lorem-ipsum')
const addon = require('./zig-out/lib/dist/lib.node')
const fs = require('fs/promises')
const { join } = require('path')
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

const value = Buffer.from('a')

console.log(addon)

console.log('go create db...', addon.createDb('./tmp'))

let total = 0

const n = 30

const bla = async () => {
  // rm tmp
  for (let j = 0; j < n; j++) {
    let i = 0

    await fs.rmdir(tmpF).catch(() => {})
    await fs.mkdir(tmpF).catch(() => {})

    for (i; i < 3; i++) {
      const key = Buffer.from('a' + i)

      const d = global.performance.now()
      // slow creates multiple transactions...
      // for (let i = 0; i < 1; i++) {
      addon.set(key, value)

      total += global.performance.now() - d
      console.log('total wrote = ', i, global.performance.now() - d, 'ns')
    }

    // }

    // console.log('wrote ', i, Date.now() - d, 'ms')
    // }
  }
}

bla().then(() => {
  console.log('WRITE TOOK', total / n)
})

// const batchTime = Date.now()
// const batch = []
// let y = 0
// for (y; y < 100_000; y++) {
//   const key = Buffer.from('derp' + y)
//   batch.push(key)
//   batch.push(value)
// }

// addon.setBatch(batch)
// console.log(`batch writing ${y} nodes took`, Date.now() - batchTime, 'ms')

const zlib = require('node:zlib')
const { LoremIpsum } = require('lorem-ipsum')
const addon = require('./zig-out/lib/dist/lib.node')

// console.log(LoremIpsum)

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
const value = Buffer.from(zlib.deflateSync(x))

console.log(addon)

console.log('go create db...', addon.createDb('./tmp'))

const d = Date.now()

let i = 0
for (i; i < 1; i++) {
  const d = Date.now()

  const key = Buffer.from('bla' + i)

  // slow creates multiple transactions...
  // for (let i = 0; i < 1; i++) {
  addon.set(key, value)
  // }

  // console.log('wrote ', i, Date.now() - d, 'ms')
}

console.log('total wrote = ', i, Date.now() - d, 'ms')

const batchTime = Date.now()
const batch = []
let y = 0
for (y; y < 1_000_000; y++) {
  const key = Buffer.from('derp' + y)
  batch.push(key)
  batch.push(value)
}

addon.setBatch(batch)
console.log(`batch writing ${y} nodes took`, Date.now() - batchTime, 'ms')

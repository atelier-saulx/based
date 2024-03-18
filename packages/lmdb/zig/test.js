const addon = require('./zig-out/lib/dist/lib.node')

const { LoremIpsum } = require('lorem-ipsum')

console.log(LoremIpsum)

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

const zlib = require('node:zlib')

console.log(addon, x)

console.log('go create db...', addon.createDb('./tmp'))

const d = Date.now()

const buf = Buffer.from(zlib.deflateSync(x))

for (let i = 0; i < 10; i++) {
  const d = Date.now()

  const x = Buffer.from('bla' + i)

  // slow creates multiple transactions...
  // for (let i = 0; i < 1; i++) {
  addon.set(x, buf)
  // }

  console.log('wrote ', i * 1e6, Date.now() - d, 'ms')
}

console.log('wrote 10M', Date.now() - d, 'ms')

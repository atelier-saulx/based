import test from 'ava'
import { LoremIpsum } from 'lorem-ipsum'
import { join, dirname } from 'path'
import assert from 'node:assert'
import { fileURLToPath } from 'node:url'
import addon from '../nativebla.js'

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

test('set and get single', (t) => {
  const key = Buffer.alloc(20)
  key.write('aaa')
  console.log('key=\t', key)

  const value = Buffer.from('sdkfhjjsdlfjksdkjhgfkshgklsdflkjsd')
  console.log('value=\t', value)
  addon.set(key, value)
  const res = addon.get(key)
  console.log('\nexpected =\t', value)
  console.log('actual =\t', res)
  t.deepEqual(res, value)
})

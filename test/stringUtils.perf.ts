import test from './shared/test.js'
import { perf } from './shared/assert.js'
import { fastPrng } from '../src/utils/fastPrng.js';
import { DECODER, ENCODER } from '../src/utils/uint8.js';
import native from '../src/native.js'

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
let rnd: ReturnType<typeof fastPrng>

function createRandomString(length: number): string {
  const result = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    result[i] = chars.charCodeAt(rnd(0, chars.length - 1));
  }
  return DECODER.decode(result)
}

let i = 0;
let j = 0;

await test('string len', async (t) => {
  const opts = { repeat: 100_000 } as const

  for (const len of [10, 100, 512, 1024]) {
    rnd = fastPrng()
    await perf(async () => {
      i += ENCODER.encode(createRandomString(1024)).byteLength
    }, `ENCODER ${len}`, opts)

    rnd = fastPrng()
    await perf(async () => {
      j += native.stringByteLength(createRandomString(1024))
    }, `stringByteLength ${len}`, opts)
    console.log(i, j)
  }
})

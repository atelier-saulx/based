import test from './shared/test.js'

const perf = (fn: Function, loops: number) => {
  const start = Date.now()
  while (loops-- > 0) {
    fn(loops)
  }
  const end = Date.now()
  return end - start
}

const compare = (...args) => {
  const fns = []
  let loops = 0
  let round = 100_000

  for (const arg of args) {
    if (typeof arg === 'function') {
      fns.push(arg)
    } else if (typeof arg === 'number') {
      if (loops) {
        round = arg
      } else {
        loops = arg
      }
    }
  }

  const l = fns.length

  loops ||= 1000

  while (round--) {
    let i = l
    while (i--) {
      const fn = fns[i]
      fn.time ??= 0
      fn.time += perf(fn, loops)
    }
  }

  Array.from(fns)
    .sort(({ time: a }, { time: b }) => a - b)
    .forEach(({ name, time }, index) => {
      console.log(`#${index + 1}: ${name} ${time}ms`)
    })
}

await test('perf write to buffer', async (t) => {
  const buf = Buffer.alloc(4)

  const writeNumber = (buf, v, pos, byteLength) => {
    buf[pos++] = v
    while (--byteLength) buf[pos++] = v >>>= 8
  }

  compare(
    function writeInBuf(i) {
      const v = i * 400
      buf.writeUint32LE(v, 0)
    },
    function putInBuf(i) {
      let v = i * 400
      let pos = 0
      buf[pos++] = v
      buf[pos++] = v >>>= 8
      buf[pos++] = v >>>= 8
      buf[pos++] = v >>>= 8
    },
    function putInBufWithFn(i) {
      writeNumber(buf, i * 400, 0, 4)
    },
    10000,
    50000,
  )
})

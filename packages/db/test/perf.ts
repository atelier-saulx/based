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
  let round = 1

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

const ieee754: any = {}
let eLen = 8 * 8 - 52 - 1
const eMax = (1 << eLen) - 1
const eBias = eMax >> 1
const rt = 0
const d = 1

const write64 = function (buffer, value, offset) {
  let e, m, c
  let i = 0
  let eLen = 8 * 8 - 52 - 1

  value = +value
  offset = offset >>> 0

  const s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  e = Math.floor(Math.log(value) / Math.LN2)
  if (value * (c = Math.pow(2, -e)) < 1) {
    e--
    c *= 2
  }

  if (e + eBias >= 1) {
    value += rt / c
  } else {
    value += rt * Math.pow(2, 1 - eBias)
  }

  if (value * c >= 2) {
    e++
    c /= 2
  }

  if (e + eBias >= eMax) {
    m = 0
    e = eMax
  } else if (e + eBias >= 1) {
    m = (value * c - 1) * Math.pow(2, 52)
    e = e + eBias
  } else {
    m = value * Math.pow(2, eBias - 1) * Math.pow(2, 52)
    e = 0
  }

  let mLen = 52
  while (mLen >= 8) {
    buffer[offset + i] = m & 0xff
    i += d
    m /= 256
    mLen -= 8
  }

  e = (e << mLen) | m
  eLen += mLen
  while (eLen > 0) {
    buffer[offset + i] = e & 0xff
    i += d
    e /= 256
    eLen -= 8
  }

  buffer[offset + i - d] |= s * 128
}

// await test('perf write to buffer', async (t) => {
//   const max = 100 * 1e3 * 1e3
//   const buf = Buffer.alloc(max)

//   const writeNumber = (buf, v, pos, byteLength) => {
//     buf[pos++] = v
//     while (--byteLength) buf[pos++] = v >>>= 8
//   }

//   compare(
//     function writeInBuf(i) {
//       buf.writeDoubleLE(1 / i, max - 8)
//     },
//     function putInBuf(i) {
//       write64(buf, 1 / i, max - 8)

//       // let pos = max - 4
//       // buf[pos++] = v
//       // buf[pos++] = v >>>= 8
//       // buf[pos++] = v >>>= 8
//       // buf[pos++] = v >>>= 8
//     },
//     // function putInBufWithFn(i) {
//     //   writeNumber(buf, i * 400, 0, 4)
//     // },
//     10_000_000,
//   )
// })

// await test('perf write to buffer', async (t) => {
//   const max = 100 * 1e3 * 1e3
//   const buf = Buffer.alloc(max)

//   const writeNumber = (buf, v, pos, byteLength) => {
//     buf[pos++] = v
//     while (--byteLength) buf[pos++] = v >>>= 8
//   }

//   compare(
//     function writeInBuf(i) {
//       const v = i * 400
//       buf.writeUint32LE(v, max - 4)
//     },
//     function putInBuf(i) {
//       let v = i * 400
//       let pos = max - 4
//       buf[pos++] = v
//       buf[pos++] = v >>>= 8
//       buf[pos++] = v >>>= 8
//       buf[pos++] = v >>>= 8
//     },
//     // function putInBufWithFn(i) {
//     //   writeNumber(buf, i * 400, 0, 4)
//     // },
//     10000,
//     50000,
//   )
// })

// await test('perf write to buffer', async (t) => {
//   const obj = {
//     len: 0,
//   }

//   const incr1 = (obj) => {
//     obj.len++
//   }

//   const incr2 = (n) => {
//     return n + 1
//   }

//   compare(
//     function args() {
//       obj.len = 0
//       let i = 100
//       while (i--) {
//         incr1(obj)
//       }
//     },
//     function ctx() {
//       obj.len = 0

//       let pos = 0
//       let i = 100
//       while (i--) {
//         pos = incr2(pos)
//       }

//       obj.len = pos
//     },
//     10000,
//     10000,
//   )
// })

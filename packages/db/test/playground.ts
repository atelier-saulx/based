import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

await wait(100)

try {
  await fs.rm(dbFolder, { recursive: true })
} catch (err) {}
await fs.mkdir(dbFolder)
const db = new BasedDb({
  path: dbFolder,
})

db.updateSchema({
  types: {
    user: {
      fields: {
        age: { type: 'integer' },
        myBlup: { type: 'reference', allowedType: 'blup' },
        name: { type: 'string' },
        flap: { type: 'integer' },
        email: { type: 'string', maxLength: 14 }, // maxLength: 10 // maxLength: 15
        snurp: { type: 'string' },
        // burp: { type: 'integer' },
        location: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            x: { type: 'integer' },
            y: { type: 'integer' },
          },
        },
      },
    },
    blup: {
      fields: {
        flap: {
          type: 'string',
          // @ts-ignore
          maxBytes: 1,
        },
        name: { type: 'string' },
      },
    },
    simple: {
      // min max on string
      fields: {
        // @ts-ignore
        countryCode: { type: 'string', maxBytes: 2 },
        lilBlup: { type: 'reference', allowedType: 'blup' },
        // vectorClock: { type: 'integer' },
        user: { type: 'reference', allowedType: 'user' },
      },
    },
  },
})

const users = []

const amount = 1e6

const d = Date.now()

for (let i = 0; i < amount; i++) {
  // const blup = db.create('blup', {
  //   // name: 'blup ! ' + i,
  //   flap: 'A',
  // })

  users.push(
    db.create('user', {
      // myBlup: blup,
      // age: amount - i
      age: ~~(Math.random() * 99) + 1,
      name: 'Mr ' + i,
      // burp: 66,
      // snurp: 'derp derp',
      // email: 'merp_merp_' + i + '@once.net',
      // location: {
      // label: 'BLA BLA',
      // },
    }),
  )
}

// db.drain()

// for (let i = 0; i < amount; i++) {
//   db.create('simple', {
//     // this can be optmized by collecting the refs then go trough them in order
//     // so you add the ids in order in a 'ordered list

//     user: i + 1,
//     // 3x slower with random access
//     // user: users[~~(Math.random() * users.length)], // TODO: add setting on other field as well...
//     // vectorClock: i,
//     // countryCode: 'aa',
//     lilBlup: 1,
//   })
// }

db.drain()

console.log(
  'Write',
  amount,
  'items',
  'total db time',
  db.writeTime,
  'ms',
  Date.now() - d,
  'ms\n',
)

// const logger = (x, empty = '') => {
//   for (const key in x) {
//     if (key === 'fromRef') {
//       console.log(empty, key, ':', `[${x[key].path.join('.')}]`)
//     } else if (key !== 'schema' && key !== 'includeTree') {
//       if (key === 'refIncludes') {
//         console.log(empty, ' -- ref includes!')
//         for (const k in x[key]) {
//           console.log(empty, ' -- STARRT: ', k)
//           logger(x[key][k], empty + '  ')
//         }
//       } else {
//         console.log(empty, key, ':', x[key])
//       }
//     }
//   }
//   if (!empty) {
//     console.log('\n')
//   }
// }

// logger(result.query.includeDef)

// console.log(new Uint8Array(result.buffer), result.length)

// console.dir(result.toObject(), { depth: 10 })

// db.create('user', {
//   // myBlup: blup,
//   // age: amount - i
//   age: 0,
//   // name: 'Mr ' + i,
//   // burp: 66,
//   name: 'A MR POEPOE',
//   // snurp: 'derp derp',
//   // email: 'merp_merp_' + i + '@once.net',
//   // location: {
//   // label: 'BLA BLA',
//   // },
// })

db.drain()

console.log(
  db.query('user').range(0, 5e5).include('name', 'age').sort('name').get(),
)

console.log(
  db.query('user').range(0, 5e5).include('name', 'age').sort('name').get(),
)

// console.log(
//   db
//     .query('user')
//     .range(0, 10)
//     .filter('age', '<', 0)
//     .include('name', 'age')
//     .sort('name')
//     .get(),
// )

// for (const item of result.data) {
//   // console.info('\nITEM ID --->', item.id)
//   // console.info('| FLAP--->', item.flap)
//   // console.info('| COUNTRY--->', item.countryCode)
//   // console.info('| lilBlup --->', item.lilBlup)
//   // console.info('| lilBlup FLAP--->', item.lilBlup.flap)
//   // console.info('| lilBlup NAME--->', item.lilBlup.name.length)

//   if (item.lilBlup.name.length > 0) {
//     console.log(
//       'WTF',
//       item.id,
//       item.lilBlup.name.length,
//       '?',
//       Buffer.from(item.lilBlup.name),
//     )
//     break
//   }
//   // console.info('| lilBlup id--->', item.user.myBlup.id)
//   // console.info('| user age--->', item.user.age)
//   // console.info('| user id--->', item.user.id) // bit wrong scince it can not exist...
//   // console.info('| flap--->', item.flap)
//   // console.info('| user.myBlup.flap--->', item.user.myBlup.flap)
//   // console.info('user.myBlup.name--->', item.user.myBlup.name)
//   // console.info('user.myBlup.id--->', item.user.myBlup.id)
//   // console.info('user.id--->', item.user.id)
//   i++
// }

// db.stats()

console.log('------- DERP')
const ids = []

const flap: Set<number> = new Set()

for (let i = 1; i < 10; i++) {
  flap.add(~~(Math.random() * 1e6))
  // ids.push(~~(Math.random() * 1e6))
}

// has to be prob done by the query function itself.. uniqueness is required
ids.push(...flap.values())

const x = [
  // new Uint8Array([5, 6, 7, 8]),
  // new Uint8Array([5, 6, 7, 9]),
  // new Uint8Array([1, 0, 0, 0]),
  // new Uint8Array([1, 0, 0, 1]),
  // new Uint8Array([1, 0, 0, 2]),
  // new Uint8Array([1, 0, 0, 0]),
]

for (let i = 0; i < 1e5; i++) {
  const bla = Buffer.allocUnsafe(4)
  // for small numbers BE is better for large numbers LE is better
  bla.writeUInt32LE(i)
  // read in reverse
  // worse length faster check
  const s = new Uint8Array([bla[0], bla[1], bla[2], bla[3]])
  x.push(s)
}

type Flap = any

var bufferSize = 0
var total = 0
const make = (x: Uint8Array, t: Flap, nr: number): Flap => {
  if (!t[x[nr]]) {
    t.size++
    total++
    bufferSize += 5
    t[x[nr]] =
      nr === 3
        ? {
            parent: t,
            size: 0,
            total: 1,
            branchSize: 1,
          }
        : {
            parent: t,
            size: 0,
            total: 1,
            branchSize: 1,
          }
    let p = t
    while (p) {
      p.branchSize++
      p = p.parent
    }
  } else {
    t[x[nr]].total++
  }
  if (nr < 3) {
    // add cnt that you can bring down
    make(x, t[x[nr]], nr + 1)
  }
  return t
}

const t: Flap = { size: 0, branchSize: 0, total: 0 }

for (const y of x) {
  make(y, t, 0)
}

const log = (t: Flap, index: string) => {
  for (const key in t) {
    if (
      key !== 'parent' &&
      key !== 'size' &&
      key !== 'branchSize' &&
      key !== 'total'
    ) {
      console.log(
        `${index} ${key} :`,
        `${t[key].branchSize} ${t[key].total > 1 ? `[${t[key].total}]` : t[key].total}`,
      )
      log(t[key], index + '  ')
    }
  }
}

const buff = Buffer.allocUnsafe(bufferSize)
let offset = 0
const buftime = (t: Flap) => {
  for (const key in t) {
    if (
      key !== 'parent' &&
      key !== 'size' &&
      key !== 'branchSize' &&
      key !== 'total'
    ) {
      const s = t[key]
      buff[offset] = Number(key)
      buff.writeUint16LE(s.branchSize * 5, 1 + offset)
      // if (s.total > 255) {
      // console.log('BLAAARR', s.total, key)
      // }
      buff.writeUint16LE(s.total, 3 + offset)
      // buff[3 + offset] = s.total
      offset += 5
      buftime(t[key])
    }
  }
}

console.log({ total, len: x.length * 4, t: Object.keys(t).length - 4 })
console.log('---------------------------')
// log(t, '')
console.log('---------------------------')

// console.log('------------ MAke buffer ---------------')
buftime(t)
// console.log('---------------------------')

console.log('------------  tree again ---------------')

const buftime2 = (t: Flap, offset: number, max: number) => {
  let i = offset
  while (i < max) {
    const key = buff[i]
    const total = buff.readUint16LE(i + 3)
    const len = buff.readUint16LE(i + 1)
    const size = 0
    const n = {
      size,
      branchSize: len / 5,
      total,
    }
    t[key] = n
    buftime2(n, offset + 5, len + offset)
    i += len
  }
}

const xxx = {}
console.log(buftime2(xxx, 0, buff.byteLength))

// console.log(xxx)

console.log('---------------------------')

console.log('---------------------------')
// log(xxx, '')
console.log('---------------------------')

const getIdFast = (id: Uint8Array, buff: Buffer) => {
  let i = 0
  while (i < buff.length) {
    const amountIndex0 = i + 3
    const len0 = buff.readUint16LE(i + 1)
    if (buff.readUint16LE(amountIndex0) == 0) {
      i += len0
    } else if (id[0] == buff[i]) {
      const end0 = len0 + i
      i += 5
      while (i < end0) {
        const amountIndex1 = i + 3
        const len1 = buff.readUint16LE(i + 1)
        if (buff.readUint16LE(amountIndex1) == 0) {
          i += len1
        } else if (id[1] == buff[i]) {
          const end1 = len1 + i
          i += 5
          while (i < end1) {
            const amountIndex2 = i + 3
            const len2 = buff.readUint16LE(i + 1)
            if (buff.readUint16LE(amountIndex2) == 0) {
              i += len2
            } else if (id[2] == buff[i]) {
              const end2 = len2 + i
              i += 5
              while (i < end2) {
                const amountIndex3 = i + 3
                const len3 = buff.readUint16LE(i + 1)
                if (buff.readUint16LE(amountIndex3) == 0) {
                  i += len3
                } else if (id[3] == buff[i]) {
                  buff.writeUint16LE(
                    buff.readUint16LE(amountIndex0) - 1,
                    amountIndex0,
                  )
                  buff.writeUint16LE(
                    buff.readUint16LE(amountIndex1) - 1,
                    amountIndex1,
                  )
                  buff.writeUint16LE(
                    buff.readUint16LE(amountIndex2) - 1,
                    amountIndex2,
                  )
                  buff.writeUint16LE(
                    buff.readUint16LE(amountIndex3) - 1,
                    amountIndex3,
                  )

                  // buff[amountIndex0]--
                  // buff[amountIndex1]--
                  // buff[amountIndex2]--
                  // buff[amountIndex3]--
                  return true
                } else {
                  i += len3
                }
              }
            } else {
              i += len2
            }
          }
        } else {
          i += len1
        }
      }
    } else {
      i += len0
    }
  }
  return false
}

// console.log('flap', getIdFast(new Uint8Array([1, 0, 0, 0]), buff))

// console.log(
//   'flap - should be removed',
//   getIdFast(new Uint8Array([1, 0, 0, 0]), buff),
// )

const ids2 = []

for (let i = 0; i < 1e6; i++) {
  const bla = Buffer.allocUnsafe(4)
  // for small numbers BE is better for large numbers LE is better
  bla.writeUInt32LE(i)
  // read in reverse
  // worse length faster check
  const s = new Uint8Array([bla[0], bla[1], bla[2], bla[3]])
  ids2.push(s)
}

ids2.reverse()

const moreIds = []
for (let j = 0; j < 1e5; j++) {
  moreIds.push(j)
}

console.log('------------go go go---------------')

const ffd = Date.now()

let found = 0

for (let i = 0; i < ids2.length; i++) {
  // console.log('\n\nINSPECT', ids2[i])
  const x = getIdFast(ids2[i], buff)
  // console.log('MATCH EQ', x, 'to', ids2[i])
  if (x) {
    found++
  }
}

// var end = moreIds.length
// for (let i = 0; i < 1e6; i++) {
//   for (let j = 0; j < end; j++) {
//     if (moreIds[j] === ids2[i]) {
//       found++
//       moreIds[j] = moreIds[end - 1]
//       end--
//     }
//   }
// }

console.log('!!!', found, Date.now() - ffd, ' ms')

// console.log(new Uint8Array(buff))

// console.log(db.query('user', ids).include('name', 'age').sort('name').get())

// db.tester()

await wait(0)

// console.log('flap', getIdFast(new Uint8Array([1, 0, 0, 1])))
// console.log('flap2', getIdFast(new Uint8Array([1, 0, 0, 1])))

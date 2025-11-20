import { BasedDb } from '../src/index.js'
import { crc32c } from '@based/hash'
import test from './shared/test.js'
import { equal } from './shared/assert.js'
import { crc32 as nativeCrc32 } from '../src/index.js'
import { langCodesMap } from '@based/schema'

const ENCODER = new TextEncoder()

await test('Comparing hash generation collision', async (t) => {
  let crc32set = new Set()
  let collision = 0
  for (let i = 0; i < 1e6; i++) {
    const f = ENCODER.encode(`oid${i + 1e6}`)
    const x = crc32c(f)
    if (crc32set.has(x)) {
      collision++
    }
    crc32set.add(x)
  }
  console.log(`1E6 CRC32c TS collision: ${collision}`)
  crc32set = new Set()
  collision = 0
  for (let i = 0; i < 1e6; i++) {
    const f = ENCODER.encode(`oid${i + 1e6}`)
    const x = nativeCrc32(f)
    if (crc32set.has(x)) {
      collision++
    }
    crc32set.add(x)
  }
  console.log(`1E6 CRC32c Native collision: ${collision}`)

  const langs = [...langCodesMap.keys()]

  const randomLanguages = (i) => {
    const len = 10
    const arr = [i + 1e4, ~~(Math.random() * 4000000000)]
    for (let j = 0; j < len; j++) {
      arr.push(langs[~~(Math.random() * langs.length)])
    }
    return arr
  }

  crc32set = new Set()
  collision = 0
  for (let i = 0; i < 1e4; i++) {
    const f = ENCODER.encode(randomLanguages(i).join(''))
    const x = crc32c(f)
    if (crc32set.has(x)) {
      collision++
    }
    crc32set.add(x)
  }
  console.log(`1E4 langs CRC32c TS collision: ${collision}`)
  crc32set = new Set()
  collision = 0
  for (let i = 0; i < 1e4; i++) {
    const f = ENCODER.encode(randomLanguages(i).join(''))
    const x = nativeCrc32(f)
    if (crc32set.has(x)) {
      collision++
    }
    crc32set.add(x)
  }
  console.log(`1E4 langs CRC32c Native collision: ${collision}`)

  crc32set = new Set()
  collision = 0
  for (let i = 0; i < 1e6; i++) {
    const f = ENCODER.encode(JSON.stringify({ i: i + 1e6 }))
    const x = crc32c(f)
    if (crc32set.has(x)) {
      collision++
    }
    crc32set.add(x)
  }
  console.log(`1E6 json CRC32c TS collision: ${collision}`)
  crc32set = new Set()
  collision = 0
  for (let i = 0; i < 1e6; i++) {
    const f = ENCODER.encode(JSON.stringify({ i: i + 1e6 }))
    const x = nativeCrc32(f)
    if (crc32set.has(x)) {
      collision++
    }
    crc32set.add(x)
  }
  console.log(`1E6 json CRC32c Native collision: ${collision}`)
})

await test('simple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      transaction: {
        props: {
          myHash: 'number',
        },
      },
      transactionN: {
        props: {
          myNativeMadeHash: 'number',
        },
      },
    },
  })

  const transaction = await db.create('transaction', {
    myHash: crc32c(ENCODER.encode('oid123')),
  })

  const transactionN = await db.create('transactionN', {
    myNativeMadeHash: nativeCrc32(ENCODER.encode('oid123')),
  })

  equal(
    await db.query('transaction').include('id', 'myHash').get().toObject(),
    [
      {
        id: 1,
        myHash: 2628032717,
      },
    ],
  )

  equal(
    await db
      .query('transactionN')
      .include('id', 'myNativeMadeHash')
      .get()
      .toObject(),
    [
      {
        id: 1,
        myNativeMadeHash: 2628032717,
      },
    ],
  )
})

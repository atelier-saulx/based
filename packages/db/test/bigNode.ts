import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { SchemaProps } from '@based/schema'
import { serialize } from '@based/protocol/db-read/serialize-schema'
import { deSerializeSchema, resultToObject } from '@based/protocol/db-read'
import { equal } from 'assert'

await test('big nodes', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const makeALot = (n: number) => {
    const props: SchemaProps = {}
    for (let i = 0; i < n; i++) {
      props[`f${i}`] = { type: 'int32' }
    }
    return props
  }

  await db.setSchema({
    types: {
      mega: {
        props: {
          ...makeALot(4096),
          ref: { type: 'reference', ref: 'giga', prop: 'ref' },
        },
      },
      giga: {
        props: {
          ...makeALot(16383),
          ref: { type: 'reference', ref: 'mega', prop: 'ref' },
        },
      },
    },
  })

  const mega1 = db.create('mega', {})
  await db.drain()

  const mega2 = db.create('mega', {
    f0: 10,
    f4092: 1337,
  })
  await db.drain()

  const giga1 = db.create('giga', {})
  await db.drain()

  const giga2 = db.create('giga', {
    f0: 10,
    f100: 1337,
  })
  await db.drain()

  const mega = (await db.query('mega').get()).toObject()
  const giga = (await db.query('giga').get()).toObject()
  deepEqual(mega[1].f4092, 1337)
  deepEqual(giga[1].f100, 1337)

  db.update('mega', mega1, { ref: giga2 })
  db.update('giga', giga1, { ref: mega2 })
  await db.drain()

  const megaRefQ = await db.query('mega').include('ref').get()

  const megaRef = megaRefQ.toObject()
  const gigaRef = (await db.query('giga').include('ref').get()).toObject()
  deepEqual(gigaRef[0].ref.id, 2)
  deepEqual(megaRef[1].ref.id, 1)

  const megaInclude = await db.query('mega').get()

  const serializedSchema = serialize(megaInclude.def.readSchema)
  const deserializedSchema = deSerializeSchema(serializedSchema)

  const obj = resultToObject(
    deserializedSchema,
    megaInclude.result,
    megaInclude.result.byteLength - 4,
    0,
  )

  deepEqual(obj[1].f4092, 1337)

  const megaIncludeSelective = await db.query('mega').include('f4092').get()

  const serializedSchemaSmall = serialize(megaIncludeSelective.def.readSchema)
  const deserializedSchemaSmall = deSerializeSchema(serializedSchemaSmall)

  const obj2 = resultToObject(
    deserializedSchemaSmall,
    megaIncludeSelective.result,
    megaIncludeSelective.result.byteLength - 4,
    0,
  )

  deepEqual(obj2[1].f4092, 1337, 'seclective include large schema')
})

import test from 'ava'
import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb, FieldDef, SchemaTypeDef, readSchemaTypeDefFromBuffer } from '../src/index.js'
import { join, dirname, resolve } from 'path'
import { createRequire } from "node:module"
const selva = createRequire(import.meta.url)("../../build/libselva.node")

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

function schema2selva(schema: { [key: string]: SchemaTypeDef }) {
    const typeNames = Object.keys(schema)
    const types = Object.values(schema)
    const selvaSchema: Buffer[] = []

    for (let i = 0; i < types.length; i++) {
      const t = types[i]
      const vals = Object.values(t.fields)
      const mainFields: FieldDef[] = []
      const restFields: FieldDef[] = []

      for (const f of vals) {
        if (f.seperate) {
          restFields.push(f)
        } else {
          mainFields.push(f)
        }
      }

      console.log(mainFields)
      console.log(restFields)

	  // TODO Remove this once the types agree
      const typeMap = {
        'timestamp': 1,
        'created': 2,
        'updated': 3,
        'number': 4,
        'integer': 5,
        'boolean': 9,
        'reference': 13,
        'enum': 10,
        'string': 11,
        'references': 14,
	  }
      const toSelvaSchemaBuf = (f: FieldDef): number[] => {
        if (f.type == 'reference' || f.type == 'references') {
          const dstType: SchemaTypeDef = schema[f.allowedType]
          const buf = Buffer.allocUnsafe(6)

          buf.writeUInt8(typeMap[f.type], 0)
          buf.writeUInt8(dstType.fields[f.inverseField].selvaField, 1)
          buf.writeUInt32LE(typeNames.indexOf(f.allowedType), 2)
          return [...buf.values()]
        } else {
          return [typeMap[f.type]]
        }
      }
      selvaSchema.push(Buffer.from([
        mainFields.length,
        ...mainFields.map((f) => toSelvaSchemaBuf(f)).flat(1),
        ...restFields.map((f) => toSelvaSchemaBuf(f)).flat(1),
      ]))
    }

    return selvaSchema
}

test.serial.only('query + filter', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)
  const db = new BasedDb({
    path: dbFolder,
  })

  const dbp = selva.db_create()
  db.native = {
    modify: (buff: Buffer, len: number) => {
      console.log('lullz flush buffer', len)
    },
    getQuery: (...args) => {
      console.log('lullllz', args)
      return Buffer.allocUnsafe(0)
    },
  }
  await wait(1)

  db.updateSchema({
    types: {
      simple: {
        prefix: 'aa',
        fields: {
          flap: { type: 'string' },
          user: {
            type: 'reference',
            allowedType: 'user',
            inverseProperty: 'simples',
          },
          vectorClock: { type: 'integer' },
          location: {
            type: 'object',
            properties: {
              long: { type: 'number' },
              lat: { type: 'number' },
            },
          },
        },
      },
      user: {
        prefix: 'us',
        fields: {
          name: { type: 'string' },
          simples: {
            type: 'references',
            allowedType: 'simple',
            inverseProperty: 'user'
          },
        }
      },
    },
  })

  const schemaBufs = schema2selva(db.schemaTypesParsed)
  //console.dir(db.schemaTypesParsed, { depth: 100 })
  console.log('bufs', schemaBufs)
  for (let i = 0; i < schemaBufs.length; i++) {
    console.log(`schema update. type: ${i} res: ${selva.db_schema_create(dbp, i, schemaBufs[i])}`)
  }

  const createUser = (id: number, name: string) => {
    const fields = db.schemaTypesParsed.user.fields
    const nameLen = Buffer.byteLength(name)
    const buf = Buffer.allocUnsafe(5 + nameLen)
    let off = 0

    // name
    buf.writeUInt32LE(5 + nameLen, off) // len
    buf.writeInt8(fields.name.selvaField, off += 4) // field
    buf.write(name, off += 1)
    off += nameLen

    console.log(`create user ${name}:`, selva.db_update(dbp, 1, id, buf))
  }
  createUser(0, 'Synergy Greg')

  //const dx = peroformance.now()
  console.log('GO!', process.pid)
  await wait(15e3)
  const fields = db.schemaTypesParsed.simple.fields

  const NR_NODES = 5e6
  const DATA_SIZE = 84 + 9
  const buf = Buffer.allocUnsafe(DATA_SIZE * NR_NODES)
  let off = 0
  for (let i = 0; i < NR_NODES; i++) {
    //const node = {
    //  //user: i,
    //  // refs: [0, 1, 2], //generateRandomArray(),
    //  // flap: 'AMAZING 123',
    //  // flap: 'my flap flap flap 1 epofjwpeojfwe oewjfpowe sepofjw pofwejew op mwepofjwe opfwepofj poefjpwofjwepofj wepofjwepofjwepofjwepofjwepofjwpo wepofj wepofjwepo fjwepofj wepofjwepofjwepofjwepofjc pofjpoejfpweojfpowefjpwoe fjewpofjwpo',
    //  vectorClock: i % 4,
    //  location: {
    //    long: 52,
    //    lat: 52,
    //  },
    //}

    // UpdateBatch
    buf.writeUInt32LE(DATA_SIZE, off)
    buf.writeUInt32LE(i, off += 4)
    off += 4

    // vectorClock
    buf.writeUInt32LE(9, off) // len
    buf.writeInt8(fields.vectorClock.selvaField, off += 4) // field
    buf.writeInt32LE(i % 4, off += 1)
    off += 4

    // flap
    buf.writeUint32LE(41, off) // len
    buf.writeInt8(fields.flap.selvaField, off += 4) // field
    buf.write('Hippity hoppity there is no property', off += 1)
    off += 36

    // long
    buf.writeUInt32LE(13, off) // len
    buf.writeInt8(fields['location.long'].selvaField, off += 4) // field
    buf.writeDoubleLE(52, off += 1)
    off += 8

    // lat
    buf.writeUInt32LE(13, off) // len
    buf.writeInt8(fields['location.lat'].selvaField, off += 4) // field
    buf.writeDoubleLE(52, off += 1)
    off += 8

    // user ref
    buf.writeUInt32LE(9, off) // len
    buf.writeInt8(fields['user'].selvaField, off += 4) // field
    buf.writeUint32LE(0, off += 1)
    off += 4

    //selva.db_update(dbp, 0, i, buf.subarray(0, off))
    //selva.db_update(dbp, 0, i, buf)
  }
  const dx = performance.now()
  console.log('batch', selva.db_update_batch(dbp, 0, buf))
  console.log(Math.round(performance.now() - dx), 'ms')


  console.log('GET')
  for (let nodeId = 0; nodeId < 20; nodeId++) {
    console.log(`${nodeId}.vectorClock`, selva.db_get_field(dbp, 0, nodeId, fields.vectorClock.selvaField))
  }
  console.log(`now get flap: "${selva.db_get_field(dbp, 0, 10, fields.flap.selvaField)}"`)
  console.log('ref', selva.db_get_field(dbp, 0, 10, fields.user.selvaField))

  // orderded DBIs
  // in mem in DB add if query is active this will also create DBIS for SORTING if required

  // READ CACHE SIZE []

  //const d = Date.now()
  //const ids = db
  //  .query('simple')
  //  .filter('vectorClock', '>', 1)
  //  // .filter(['refs', 'has', [2]])
  //  // .or(['refs', 'has', [1234]])
  //  // .sort('vectorClock', 'asc')
  //  .range(0, 1000)
  //  .get()

  //console.info('query result ==', ids, Date.now() - d, 'ms')
  console.log(process.memoryUsage())

  t.true(true)
})

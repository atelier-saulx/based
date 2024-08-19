import test from 'ava'
import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import {
  BasedDb,
  FieldDef,
  SchemaTypeDef,
  readSchemaTypeDefFromBuffer,
} from '../src/index.js'
import { join, dirname, resolve } from 'path'
import { createRequire } from 'node:module'
const selva = createRequire(import.meta.url)('../../build/libselva.node')

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

const FILTER = {
  CONJ_NECESS: 2,
  CONJ_POSS: 3,
  OP_EQ_TYPE: 6,
  OP_EQ_INTEGER: 7,
}

function schema2selva(schema: { [key: string]: SchemaTypeDef }) {
  const typeNames = Object.keys(schema)
  const types = Object.values(schema)

  return types.map((t, i) => {
    const vals = Object.values(t.fields)
    const mainFields: FieldDef[] = []
    const restFields: FieldDef[] = []

    const ALL_MAIN = false
    for (const f of vals) {
      if (ALL_MAIN) {
        mainFields.push(f)
      } else {
        if (f.seperate) {
          restFields.push(f)
        } else {
          mainFields.push(f)
        }
      }
    }
    mainFields.sort((a, b) => a.selvaField - b.selvaField)
    restFields.sort((a, b) => a.selvaField - b.selvaField)

    //console.log('\nnode_type:', i)
    //console.log('mainFields:', mainFields)
    //console.log('restFields:', restFields)

    // TODO Remove this once the types agree
    const typeMap = {
      timestamp: 1,
      created: 2,
      updated: 3,
      number: 4,
      integer: 5,
      boolean: 9,
      reference: 13,
      enum: 10,
      string: 11,
      references: 14,
    }
    const toSelvaSchemaBuf = (f: FieldDef): number[] => {
      if (f.type === 'reference' || f.type === 'references') {
        const dstType: SchemaTypeDef = schema[f.allowedType]
        const buf = Buffer.allocUnsafe(4)

        buf.writeUInt8(typeMap[f.type], 0)
        buf.writeUInt8(dstType.fields[f.inverseField].selvaField, 1)
        buf.writeUInt16LE(typeNames.indexOf(f.allowedType), 2)
        return [...buf.values()]
      } else if (f.type === 'string') {
        return [typeMap[f.type], f.len < 50 ? f.len : 0]
      } else {
        return [typeMap[f.type]]
      }
    }
    return Buffer.from([
      mainFields.length,
      ...mainFields.map((f) => toSelvaSchemaBuf(f)).flat(1),
      ...restFields.map((f) => toSelvaSchemaBuf(f)).flat(1),
    ])
  })
}

const createUser = (db: BasedDb, dbp, id: number, name: string) => {
  const typeId = Object.keys(db.schemaTypesParsed).indexOf('user')
  const fields = db.schemaTypesParsed.user.fields
  const nameLen = Buffer.byteLength(name)
  const buf = Buffer.allocUnsafe(5 + nameLen)
  let off = 0

  // name
  buf.writeUInt32LE(5 + nameLen, off) // len
  buf.writeInt8(fields.name.selvaField, (off += 4)) // field
  buf.write(name, (off += 1))
  off += nameLen

  return selva.db_update(dbp, typeId, id, buf)
}

test.serial.skip('create and destroy a db', async (t) => {
  const dbp = selva.db_create()

  console.log('Destroy the db')
  const startDbDel = performance.now()
  selva.db_destroy(dbp)
  console.log(`Done: ${Math.round(performance.now() - startDbDel)} ms`)

  t.true(true)
})

test.serial('query + filter', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)
  const db = new BasedDb({
    path: dbFolder,
  })

  const dbp = selva.db_create()
  //db.native = {
  //  modify: (buff: Buffer, len: number) => {
  //    console.log('lullz flush buffer', len)
  //  },
  //  getQuery: (...args) => {
  //    console.log('lullllz', args)
  //    return Buffer.allocUnsafe(0)
  //  },
  //}
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
            inverseProperty: 'user',
          },
        },
      },
    },
  })

  const schemaBufs = schema2selva(db.schemaTypesParsed)
  //console.dir(db.schemaTypesParsed, { depth: 100 })
  //console.log('bufs', schemaBufs)
  for (let i = 0; i < schemaBufs.length; i++) {
    t.deepEqual(selva.db_schema_create(dbp, i, schemaBufs[i]), 0)
  }

  t.deepEqual(createUser(db, dbp, 0, 'Synergy Greg'), 0)

  //const dx = peroformance.now()
  console.log('GO!', process.pid)
  //await wait(15e3)
  const fields = db.schemaTypesParsed.simple.fields

  const NR_NODES = 5e6
  // const NR_NODES = 100e3
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
    buf.writeUInt32LE(i, (off += 4))
    off += 4

    // vectorClock
    buf.writeUInt32LE(9, off) // len
    buf.writeInt8(fields.vectorClock.selvaField, (off += 4)) // field
    buf.writeInt32LE(i % 4, (off += 1))
    off += 4

    // flap
    buf.writeUint32LE(41, off) // len
    buf.writeInt8(fields.flap.selvaField, (off += 4)) // field
    buf.write('Hippity hoppity there is no property', (off += 1))
    off += 36

    // long
    buf.writeUInt32LE(13, off) // len
    buf.writeInt8(fields['location.long'].selvaField, (off += 4)) // field
    buf.writeDoubleLE(52, (off += 1))
    off += 8

    // lat
    buf.writeUInt32LE(13, off) // len
    buf.writeInt8(fields['location.lat'].selvaField, (off += 4)) // field
    buf.writeDoubleLE(52, (off += 1))
    off += 8

    // user ref
    buf.writeUInt32LE(9, off) // len
    buf.writeInt8(fields['user'].selvaField, (off += 4)) // field
    buf.writeUint32LE(0, (off += 1))
    off += 4

    //selva.db_update(dbp, 0, i, buf.subarray(0, off))
    //selva.db_update(dbp, 0, i, buf)
  }
  const dx = performance.now()
  console.log('batch', selva.db_update_batch(dbp, 0, buf))
  console.log('updateBatch', Math.round(performance.now() - dx), 'ms')

  const typeIds = {
      simple: Object.keys(db.schemaTypesParsed).indexOf('simple'),
      user: Object.keys(db.schemaTypesParsed).indexOf('user'),
  };

  console.log('GET')
  for (let nodeId = 0; nodeId < 20; nodeId++) {
    t.deepEqual(selva.db_get_field(dbp, typeIds.simple, nodeId, fields.vectorClock.selvaField), nodeId % 4)
  }
  t.deepEqual(selva.db_get_field(dbp, typeIds.simple, 10, fields.flap.selvaField), 'Hippity hoppity there is no property')

  console.log('ref', selva.db_get_field(dbp, typeIds.simple, 10, fields.user.selvaField))

  //const trefstart = performance.now()
  //console.log('refs', selva.db_get_field(dbp, 1, 0, db.schemaTypesParsed.user.fields.simples.selvaField))
  //console.log(`took: ${Math.round(performance.now() - trefstart)} ms`)

  //selva.traverse_field_bfs(dbp, 0, 1, fields.user.selvaField, (type, nodeId) =>
  //  console.log(`type: ${type} node: ${nodeId}`),
  //)

  selva.db_set_alias(dbp, 0, 0, Buffer.from('bestalias\0'))
  t.deepEqual(selva.db_get_alias(dbp, 0, Buffer.from('bestalias\0')), 0)

  console.log('filtering:')
  let matchCount = 0
  const matchStart = performance.now()
  selva.traverse_field_bfs(dbp, typeIds.user, 0, (type, nodeId, node) => {
    //console.log(type, nodeId)

    if (type == 0) {
      //console.log(type, nodeId)
      const vectorClock = selva.db_get_field_p(
        node,
        db.schemaTypesParsed.simple.fields.vectorClock.selvaField,
      )
      if (vectorClock == 0) {
        //console.log(`type: ${type} nodeId: ${nodeId} lat: ${selva.db_get_field(node, fields['location.lat'].selvaField)}`)
        matchCount++
      }

      return -1 // stop traverse
    } else if (type == 1) {
      return db.schemaTypesParsed.user.fields.simples.selvaField
    }
  })
  const matchEnd = performance.now()
  console.log(
    `Found ${matchCount} matches in ${Math.round(matchEnd - matchStart)} ms`,
  )

  console.log('fast filtering:')
  const match1Start = performance.now()
  const fields_sel = Buffer.from([1, 1, 0, 1]) // len = 1, [ type1, field1 ]
  const adj_filter = Buffer.from([ FILTER.CONJ_NECESS, FILTER.OP_EQ_TYPE, 0, 0, FILTER.OP_EQ_INTEGER, 1, 0, 0, 0, 0 ])
  const node_filter = Buffer.from([FILTER.OP_EQ_TYPE, 0, 0])
  //const node_filter = Buffer.from([ FILTER.CONJ_NECESS, FILTER.OP_EQ_TYPE, 0, 0, FILTER.OP_EQ_INTEGER, 1, 0, 0, 0, 0 ])
  const limits = Buffer.alloc(24); // [skip, offset, limit]
  //limits.writeBigInt64LE(1000n, 0) // skip
  //limits.writeBigInt64LE(1000n, 16) // limit
  const res = selva.find(dbp, typeIds.user, 0, fields_sel, adj_filter, node_filter, limits)
  const match1End = performance.now()
  console.log(
    `Found ${res} matches in ${Math.round(match1End - match1Start)} ms`,
  )
  t.deepEqual(res, matchCount, 'Both filters have the same result');
  t.assert(match1End - match1Start < matchEnd - matchStart, 'Native is faster than js cb')

  //console.info('query result ==', ids, Date.now() - d, 'ms')
  console.log(process.memoryUsage())

  console.log('Destroy the db')
  const startDbDel = performance.now()
  selva.db_destroy(dbp)
  console.log(`Done: ${Math.round(performance.now() - startDbDel)} ms`)

  // global.gc()
})

// TODO The find in this test is now broken and the test is only meaningful on Linux anyway
test.serial.skip('1bn', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)
  const db = new BasedDb({
    path: dbFolder,
  })

  const dbp = selva.db_create()
  await wait(1)

  db.updateSchema({
    types: {
      simplex: {
        prefix: 'aa',
        fields: {
          complex: {
            type: 'reference',
            allowedType: 'complex',
            inverseProperty: 'simplie',
          },
        }
      },
      complex: {
        prefix: 'bb',
        fields: {
          flap: { type: 'string' },
          user: {
            type: 'reference',
            allowedType: 'user',
            inverseProperty: 'things',
          },
          simplie: {
            type: 'reference',
            allowedType: 'simplex',
            inverseProperty: 'complex',
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
          things: {
            type: 'references',
            allowedType: 'complex',
            inverseProperty: 'user',
          },
        },
      },
    },
  })

  const schemaBufs = schema2selva(db.schemaTypesParsed)
  for (let i = 0; i < schemaBufs.length; i++) {
    t.deepEqual(selva.db_schema_create(dbp, i, schemaBufs[i]), 0)
  }
  const typeIds = {
    user: Object.keys(db.schemaTypesParsed).indexOf('user'),
    simplex: Object.keys(db.schemaTypesParsed).indexOf('simplex'),
    complex: Object.keys(db.schemaTypesParsed).indexOf('complex'),
  }

  t.deepEqual(createUser(db, dbp, 0, 'Synergy Greg'), 0)

  console.log('GO!', process.pid)
  //await wait(15e3)

  const dx = performance.now()
  const NR_NODES_AA = 3e7
  const NR_NODES_BB = 3e7
  const CHUNK_SIZE = 536870912;
  const buf = Buffer.allocUnsafe(CHUNK_SIZE)

  // Create complices
  for (let i = 0; i < NR_NODES_BB;) {
    let off = 0
    let bytes = 0;
    const fields = db.schemaTypesParsed.complex.fields

    const DATA_SIZE = 93
    for (; bytes + DATA_SIZE < CHUNK_SIZE && i < NR_NODES_BB; bytes += DATA_SIZE) {
      // UpdateBatch
      buf.writeUInt32LE(DATA_SIZE, off)
      buf.writeUInt32LE(i++, (off += 4)) // node_id
      off += 4

      // vectorClock
      buf.writeUInt32LE(9, off) // len
      buf.writeInt8(fields.vectorClock.selvaField, (off += 4)) // field
      buf.writeInt32LE(i % 4, (off += 1))
      off += 4

      // flap
      buf.writeUint32LE(41, off) // len
      buf.writeInt8(fields.flap.selvaField, (off += 4)) // field
      buf.write('Hippity hoppity there is no property', (off += 1))
      off += 36

      // long
      buf.writeUInt32LE(13, off) // len
      buf.writeInt8(fields['location.long'].selvaField, (off += 4)) // field
      buf.writeDoubleLE(52, (off += 1))
      off += 8

      // lat
      buf.writeUInt32LE(13, off) // len
      buf.writeInt8(fields['location.lat'].selvaField, (off += 4)) // field
      buf.writeDoubleLE(52, (off += 1))
      off += 8

      // user ref
      buf.writeUInt32LE(9, off) // len
      buf.writeInt8(fields['user'].selvaField, (off += 4)) // field
      buf.writeUint32LE(0, (off += 1))
      off += 4
    }
    t.deepEqual(selva.db_update_batch(dbp, typeIds.complex, buf.subarray(0, bytes)), 0)
  }

  // Create simplies
  for (let i = 0; i < NR_NODES_AA;) {
    let off = 0
    let bytes = 0;
    const fields = db.schemaTypesParsed.simplex.fields

    const DATA_SIZE = 17
    for (; bytes + DATA_SIZE < CHUNK_SIZE && i < NR_NODES_AA; bytes += DATA_SIZE) {
      // UpdateBatch
      buf.writeUInt32LE(DATA_SIZE, off)
      buf.writeUInt32LE(i, (off += 4))
      off += 4

      // complex ref
      buf.writeUInt32LE(9, off) // len
      buf.writeInt8(fields['complex'].selvaField, (off += 4)) // field
      buf.writeUint32LE(i, (off += 1))
      off += 4

      i++
    }
    t.deepEqual(selva.db_update_batch(dbp, typeIds.simplex, buf.subarray(0, bytes)), 0)
  }
  console.log('update took', Math.round(performance.now() - dx), 'ms')

  const arch1Start = performance.now()
  selva.db_archive(dbp, 0)
  selva.db_prefetch(dbp, 1)
  const arch1End = performance.now()
  console.log(`Archived in ${Math.round(arch1End - arch1Start)} ms`)
  await wait(3e3)


  console.log('fast filtering:')
  const match1Start = performance.now()
  const fields_sel = Buffer.from([1, typeIds.user, 0, db.schemaTypesParsed.user.fields.things.selvaField]) // len = 1, [ type1, field1 ]
  const adj_filter = Buffer.from([ FILTER.CONJ_NECESS, FILTER.OP_EQ_TYPE, 1, 0, FILTER.OP_EQ_INTEGER, 2, 0, 0, 0, 0 ])
  const node_filter = Buffer.from([FILTER.OP_EQ_TYPE, typeIds.complex, 0])
  const limits = Buffer.alloc(24); // [skip, offset, limit]
  limits.writeBigInt64LE(10000n, 16) // limit
  const res = selva.find(dbp, typeIds.user, 0, fields_sel, adj_filter, node_filter)
  const match1End = performance.now()
  console.log(
    `Found ${res} matches in ${Math.round(match1End - match1Start)} ms`,
  )

  //console.info('query result ==', ids, Date.now() - d, 'ms')
  console.log(process.memoryUsage())

  console.log('Destroy the db')
  const startDbDel = performance.now()
  selva.db_destroy(dbp)
  console.log(`Done: ${Math.round(performance.now() - startDbDel)} ms`)
})

test.serial('dump save & load', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)
  const db = new BasedDb({
    path: dbFolder,
  })

  const dbp = selva.db_create()
  await wait(1)

  db.updateSchema({
    types: {
      simplex: {
        prefix: 'aa',
        fields: {
          complex: {
            type: 'reference',
            allowedType: 'complex',
            inverseProperty: 'simplie',
          },
        }
      },
      complex: {
        prefix: 'bb',
        fields: {
          flap: { type: 'string' },
          user: {
            type: 'reference',
            allowedType: 'user',
            inverseProperty: 'things',
          },
          simplie: {
            type: 'reference',
            allowedType: 'simplex',
            inverseProperty: 'complex',
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
          things: {
            type: 'references',
            allowedType: 'complex',
            inverseProperty: 'user',
          },
        },
      },
    },
  })

  const schemaBufs = schema2selva(db.schemaTypesParsed)
  for (let i = 0; i < schemaBufs.length; i++) {
    t.deepEqual(selva.db_schema_create(dbp, i, schemaBufs[i]), 0)
  }
  const typeIds = {
    simplex: Object.keys(db.schemaTypesParsed).indexOf('simplex'),
    complex: Object.keys(db.schemaTypesParsed).indexOf('complex'),
    user: Object.keys(db.schemaTypesParsed).indexOf('user'),
  };

  t.deepEqual(createUser(db, dbp, 0, 'Synergy Greg'), 0)

  console.log('GO!', process.pid)
  //await wait(15e3)

  const dx = performance.now()
  const NR_NODES_AA = 100
  const NR_NODES_BB = 100
  const CHUNK_SIZE = 536870912;
  const buf = Buffer.allocUnsafe(CHUNK_SIZE)

  // Create complices
  for (let i = 0; i < NR_NODES_BB;) {
    let off = 0
    let bytes = 0;
    const fields = db.schemaTypesParsed.complex.fields

    const DATA_SIZE = 93
    for (; bytes + DATA_SIZE < CHUNK_SIZE && i < NR_NODES_BB; bytes += DATA_SIZE) {
      // UpdateBatch
      buf.writeUInt32LE(DATA_SIZE, off)
      buf.writeUInt32LE(i++, (off += 4))
      off += 4

      // vectorClock
      buf.writeUInt32LE(9, off) // len
      buf.writeInt8(fields.vectorClock.selvaField, (off += 4)) // field
      buf.writeInt32LE(i % 4, (off += 1))
      off += 4

      // flap
      buf.writeUint32LE(41, off) // len
      buf.writeInt8(fields.flap.selvaField, (off += 4)) // field
      buf.write('Hippity hoppity there is no property', (off += 1))
      off += 36

      // long
      buf.writeUInt32LE(13, off) // len
      buf.writeInt8(fields['location.long'].selvaField, (off += 4)) // field
      buf.writeDoubleLE(52, (off += 1))
      off += 8

      // lat
      buf.writeUInt32LE(13, off) // len
      buf.writeInt8(fields['location.lat'].selvaField, (off += 4)) // field
      buf.writeDoubleLE(52, (off += 1))
      off += 8

      // user ref
      buf.writeUInt32LE(9, off) // len
      buf.writeInt8(fields['user'].selvaField, (off += 4)) // field
      buf.writeUint32LE(0, (off += 1))
      off += 4
    }
    t.deepEqual(selva.db_update_batch(dbp, typeIds.complex, buf.subarray(0, bytes)), 0)
  }

  // Create simplies
  for (let i = 0; i < NR_NODES_AA;) {
    let off = 0
    let bytes = 0;
    const fields = db.schemaTypesParsed.simplex.fields

    const DATA_SIZE = 17
    for (; bytes + DATA_SIZE < CHUNK_SIZE && i < NR_NODES_AA; bytes += DATA_SIZE) {
      // UpdateBatch
      buf.writeUInt32LE(DATA_SIZE, off)
      buf.writeUInt32LE(i, (off += 4))
      off += 4

      // complex ref
      buf.writeUInt32LE(9, off) // len
      buf.writeInt8(fields['complex'].selvaField, (off += 4)) // field
      buf.writeUint32LE(i, (off += 1))
      off += 4

      i++
    }
    t.deepEqual(selva.db_update_batch(dbp, typeIds.simplex, buf.subarray(0, bytes)), 0)
  }
  console.log('update took', Math.round(performance.now() - dx), 'ms')

  console.log('save')
  selva.db_save(dbp, "test.sdb")
  //console.log(process.memoryUsage())

  await wait(5e3)
  console.log('load')
  const dbp1 = selva.db_load("test.sdb")

  selva.traverse_field_bfs(dbp, typeIds.complex, 0, (type, nodeId, node) => {
      t.deepEqual(selva.db_exists(dbp1, type, nodeId), true)
      return -1 // stop traverse
  })
  selva.traverse_field_bfs(dbp, typeIds.simplex, 0, (type, nodeId, node) => {
      t.deepEqual(selva.db_exists(dbp1, type, nodeId), true)
      return -1 // stop traverse
  })
  selva.traverse_field_bfs(dbp, typeIds.user, 0, (type, nodeId, node) => {
      t.deepEqual(selva.db_exists(dbp1, type, nodeId), true)
      return -1 // stop traverse
  })

  console.log('Destroy the db')
  const startDbDel = performance.now()
  selva.db_destroy(dbp)
  console.log(`Done: ${Math.round(performance.now() - startDbDel)} ms`)

  t.true(true)

  // global.gc()
})

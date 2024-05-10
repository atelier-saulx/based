import test from 'ava'
import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb, readSchemaTypeDefFromBuffer } from '../src/index.js'
import newClient, {buf2payloadChunks} from '../src/selvad-client/index.js'
import { create, createBatch, update } from '../src/set2.js'
import { decodeMessageWithValues } from '../src/selvad-client/proto-value.js';
import { join, dirname, resolve } from 'path'
import {SELVA_PROTO_ARRAY, SELVA_PROTO_STRING} from '../src/selvad-client/selva_proto.js'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

async function sendSchema(client: ReturnType<typeof newClient>, schema: Buffer[]) {
  const cmdid = 36
  const seqno = client.newSeqno()
  let firstFrame = true
  let p: Promise<Buffer> | null

  for (const nodeSchema of schema) {
    const chunks = buf2payloadChunks(nodeSchema, 8)

    for (let i = 0; i < chunks.length; i++) {
      const [frame, payload] = await client.newFrame(cmdid, seqno)
      const lastFrame = i === chunks.length - 1

      const chunk = chunks[i]
      if (i === 0) { // Write header just once for each node type
        payload.writeUInt8(SELVA_PROTO_STRING, 0)
        payload.writeUint32LE(nodeSchema.length, 4)
        chunk.copy(payload, 8)
      } else {
        chunk.copy(payload)
      }
      p = client.sendFrame(frame, chunk.length, { firstFrame, lastFrame, batch: !lastFrame })
      firstFrame = false
    }
  }

  const resp = p ? decodeMessageWithValues(await p) : null
  console.log('schema write:', resp)
}

test.serial.only('query + filter', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)
  const db = new BasedDb({
    path: dbFolder,
  })

  const sClient = newClient(3000, '127.0.0.1')
  // @ts-ignore
  db.client = sClient
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
          refs: { type: 'references', allowedTypes: ['user'] },
          user: { type: 'reference', allowedTypes: ['user'] },
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
    },
  })
  await sendSchema(sClient, Object.values(db.schemaTypesParsed).map(({buf}) => buf))
  // @ts-ignore
  //console.log('schema read:', await db.client.sendRequest(37));

  console.log(
    'SCHEMA',
    db.schemaTypesParsed.simple.cnt,
    // 66 length
    db.schemaTypesParsed.simple.buf,
    db.schemaTypesParsed.simple.fieldNames
  )

  console.log(
    'SCHEMA BACK',
    readSchemaTypeDefFromBuffer(
      db.schemaTypesParsed.simple.buf,
      db.schemaTypesParsed.simple.fieldNames
    ).cnt
  )

  const refs = []
  for (let i = 1; i < 10 - 1; i++) {
    refs.push(i)
  }

  var dx = Date.now()
  console.log('GO!')

  /*
  const p = []
  for (let i = 0; i < 1e6 - 1; i++) {
  // for (let i = 0; i < 2000; i++) {
    p.push(create(db, 'simple', {
      //user: i,
      // refs: [0, 1, 2], //generateRandomArray(),
      // flap: 'AMAZING 123',
      // flap: 'my flap flap flap 1 epofjwpeojfwe oewjfpowe sepofjw pofwejew op mwepofjwe opfwepofj poefjpwofjwepofj wepofjwepofjwepofjwepofjwepofjwpo wepofj wepofjwepo fjwepofj wepofjwepofjwepofjwepofjc pofjpoejfpweojfpowefjpwoe fjewpofjwpo',
      vectorClock: i % 4,
      location: {
        long: 52,
        lat: 52,
      },
    }))
    if (i % 1000 === 0) {
      //console.log('flush')
      // @ts-ignore
      await db.client.flush()
      await Promise.all(p)
      p.length = 0
    }
  }
  */

  const t1 = Date.now()
  const objs = Array.from({ length: 1e6 }, (_, i) => ({
    vectorClock: i % 4,
    location: {
      long: 52,
      lat: 52,
    },
  }))
  console.log(Date.now() - t1, 'ms')
  const t2 = Date.now()
  await createBatch(db, 'simple', objs)
  console.log(Date.now() - t2, 'ms')

  // { set Id, amount: 10 } , checksum

  await wait(0)
  console.log(Date.now() - dx, 'ms')

  // orderded DBIs
  // in mem in DB add if query is active this will also create DBIS for SORTING if required

  // READ CACHE SIZE []

  const d = Date.now()
  const ids = db
    .query('simple')
    .filter(['vectorClock', '>', 1])
    // .filter(['refs', 'has', [2]])
    // .or(['refs', 'has', [1234]])
    // .sort('vectorClock', 'asc')
    .range(0, 1000)
    .get()

  console.info('query result ==', ids, Date.now() - d, 'ms')

  t.true(true)
})

import test from 'ava'
import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb, readSchemaTypeDefFromBuffer } from '../src/index.js'
import newClient, {buf2payloadChunks} from '../src/selvad-client/index.js'
import { create, update } from '../src/set2.js'
import { decodeMessageWithValues } from '../src/selvad-client/proto-value.js';
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

async function sendSchema(client: ReturnType<typeof newClient>, schema: Buffer) {
  const seqno = client.newSeqno()
  const chunks = buf2payloadChunks(schema)
  let p: Promise<Buffer> | null

  // TODO We should have a little smaller first chunk
  const [headFrame, headBuf] = await client.newFrame(36, seqno)
  headBuf.writeUInt8(5, 0)
  headBuf.writeUInt8(1, 4)
  headBuf.writeUInt8(4, 8)
  headBuf.writeUint32LE(schema.length, 8 + 4)
  client.sendFrame(headFrame, 16, { firstFrame: true, lastFrame: false, batch: true })
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const [frame, payload] = await client.newFrame(36, seqno)
    chunk.copy(payload)
    const lastFrame = i === chunks.length - 1
    p = client.sendFrame(frame, chunk.length, { lastFrame, batch: !lastFrame })
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
  await sendSchema(sClient, db.schemaTypesParsed.simple.buf)
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

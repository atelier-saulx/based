import test from 'ava'
import { wait } from '@saulx/utils'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

test.serial('set and simple get', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)

  const db = new BasedDb({
    path: dbFolder,
  })

  db.updateSchema({
    types: {
      simple: {
        fields: {
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
      vote: {
        fields: {
          refs: { type: 'references' },
          user: { type: 'reference', allowedTypes: ['user'] },
          vectorClock: { type: 'integer' },
          location: {
            type: 'object',
            properties: {
              long: { type: 'timestamp' },
              lat: { type: 'timestamp' },
            },
          },
        },
      },
      complex: {
        fields: {
          flap: {
            type: 'integer',
          },
          value: {
            type: 'integer',
          },
          nip: {
            type: 'string',
          },
          mep: {
            type: 'number',
          },
          created: {
            type: 'timestamp',
          },
          updated: {
            type: 'timestamp',
          },
          gerp: {
            type: 'reference',
            allowedTypes: ['vote'],
          },
          snurp: {
            type: 'object',
            properties: {
              refTime: { type: 'references', allowedTypes: ['vote'] },
              ups: { type: 'references', allowedTypes: ['vote'] },
              derp: { type: 'integer' },
              bla: { type: 'string' },
              hup: {
                type: 'object',
                properties: {
                  start: {
                    type: 'timestamp',
                  },
                  x: { type: 'integer' },
                  isDope: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  })

  // const id2 = db.create('vote', {
  //   user: 15,
  //   vectorClock: 12,
  //   location: {
  //     long: 1,
  //     lat: 1,
  //   },
  // })

  var str = 'flap'
  for (let i = 0; i < 1e3; i++) {
    str += 'bla ' + i
  }

  // console.info(str)
  console.log('---------------------------')

  var d = Date.now()
  // for (let i = 0; i < 1e9; i++) {
  //   db.create('complex', {
  //     flap: 1,
  //     // nip: 'flap flap flap flap flap flap flap flap flap flap flap flpa flpa flpal flpa',
  //     snurp: {
  //       derp: i,
  //     },
  //   })
  // }

  // await wait(0)
  // console.log('old', Date.now() - d, 'ms')

  await wait(100)
  console.log('---------------------------')
  d = Date.now()
  for (let i = 0; i < 10e6; i++) {
    db.create('complex', {
      flap: 1,
      snurp: {
        derp: i + 1,
        hup: { start: 1000 },
        bla: 'BLA!',
      },
      nip: 'flap flap flap flap flap flap flap flap flap flap flap flpa flpa flpal flpa',
    })
  }

  await wait(0)
  const bla = db.get('complex', 1)
  console.log(bla)

  console.log('new', Date.now() - d, 'ms')

  // const id = db.create('complex', {
  //   value: 666,
  //   nip: 'FRANKO!',
  //   gerp: 999,
  //   snurp: { bla: 'yuzi', ups: [1, 2, 3, 4, 5] },
  // })
  // console.log('---------------------------')

  // console.info('??', id)

  await wait(1e3)

  // const doesNotExist = db.get('simple', 0)

  // console.info('snurp', doesNotExist)

  // t.deepEqual(db.get('complex', id), {
  //   snurp: {
  //     refTime: [],
  //     hup: { start: 0, x: 0, isDope: false },
  //     ups: [1, 2, 3, 4, 5],
  //     derp: 0,
  //     bla: 'yuzi',
  //   },
  //   updated: 0,
  //   created: 0,
  //   mep: 0,
  //   flap: 0,
  //   value: 666,
  //   nip: 'FRANKO!',
  //   gerp: 999,
  // })

  // const doesNotExist = db.get('simple', 0)

  // // TODO franky when DBI does not exist and error zig will never work again...
  // t.deepEqual(doesNotExist, {
  //   location: { lat: 0, long: 0 },
  //   user: 0,
  //   vectorClock: 0,
  // })

  // const id1 = db.create('simple', {
  //   user: 1,
  //   vectorClock: 20,
  //   location: {
  //     long: 52.0123,
  //     lat: 52.213,
  //   },
  // })

  // await wait(0)
  // t.is(Math.round(db.get('simple', id1).location.long * 10000) / 10000, 52.0123)

  // const refs = []
  // for (let i = 0; i < 1e4; i++) {
  //   refs.push(i)
  // }

  // const id2 = db.create('vote', {
  //   user: 1,
  //   vectorClock: 22,
  //   location: {
  //     long: 52.1,
  //     lat: 52.2,
  //   },
  //   refs,
  // })
  // await wait(0)
  // t.is(db.get('vote', id2).vectorClock, 22)
  // t.is(db.get('vote', id2).refs.length, 1e4)

  // let d = Date.now()
  // let lId = 0
  // for (let i = 0; i < 2e6; i++) {
  //   lId = db.create('simple', {
  //     user: 1,
  //     vectorClock: i,
  //     location: {
  //       long: 52,
  //       lat: 52,
  //     },
  //   })
  // }
  // await wait(0)
  // console.info('perf', Date.now() - d, 'ms', '2M inserts (2 dbis)')

  // t.deepEqual(db.get('simple', lId), {
  //   user: 1,
  //   vectorClock: 2e6 - 1,
  //   location: {
  //     long: 52,
  //     lat: 52,
  //   },
  // })

  t.true(true)
})

test.serial('get include', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)

  const db = new BasedDb({
    path: dbFolder,
  })

  db.updateSchema({
    types: {
      something: {
        fields: {
          flap: { type: 'string' },
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

  const id = db.create('something', {
    user: 1,
    flap: 'hello',
    vectorClock: 20,
    location: {
      long: 52.0123,
      lat: 52.213,
    },
  })

  await wait(0)

  // only query...
  console.info(db.get('something', id, ['location.long', 'flap']))

  t.pass()
})

function generateRandomArray() {
  var array = []
  for (var i = 0; i < 5; i++) {
    array.push(Math.floor(Math.random() * 20) + 1)
  }
  return array
}

test.serial.only('query + filter', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}
  await fs.mkdir(dbFolder)
  const db = new BasedDb({
    path: dbFolder,
  })

  db.updateSchema({
    types: {
      simple: {
        // prefix: 'aa',
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
          smurp: {
            type: 'object',
            properties: {
              hello: { type: 'boolean' },
              ts: { type: 'timestamp' },
              pos: {
                type: 'object',
                properties: {
                  x: { type: 'integer' },
                  y: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  })

  console.log(
    db.schemaTypesParsed.simple.buf,
    db.schemaTypesParsed.simple.fieldNames,
  )

  const refs = []
  for (let i = 1; i < 10 - 1; i++) {
    refs.push(i)
  }

  var dx = Date.now()
  console.log('GO!')
  // 2.5GB structured (8M nodes 4.5sec)
  // 8 / 1.3
  //

  const now = Date.now()

  for (let i = 0; i < 5e6 - 1; i++) {
    db.create('simple', {
      vectorClock: i + 10,
      // refs: generateRandomArray(),
      // flap: 'AMAZING ' + i,
      user: 541,
      // flap: 'my flap flap flap 1 epofjwpeojfwe oewjfpowe sepofjw pofwejew op mwepofjwe opfwepofj poefjpwofjwepofj wepofjwepofjwepofjwepofjwepofjwpo wepofj wepofjwepo fjwepofj wepofjwepofjwepofjwepofjc pofjpoejfpweojfpowefjpwoe fjewpofjwpo',
      location: {
        long: 52,
        lat: 52,
      },
      smurp: {
        hello: true,
        ts: now,
        pos: {
          x: 1,
          y: 2,
        },
      },
    })
  }

  await wait(0)
  console.log('TIME (5M)', Date.now() - dx, 'ms')

  // 2 buffers
  const bla = async () => {
    const d = Date.now()
    const result = db
      .query('simple')
      .filter('vectorClock', '>', 1)
      // .include('vectorClock', 'user', 'location', 'smurp') // now support location (getting the whole object)
      .range(0, 1e3)
      .get()

    console.info(
      'query result ==',
      Date.now() - d,
      'ms',
      ~~(result.buffer.byteLength / 1000 / 1000),
      'mb',
    )

    const xxx = Date.now()

    const bla = result.data.map((f) => {
      return { id: f.id, vectorClock: f.vectorClock }
    })

    // for (const x of result.data) {
    //   // inspect on x as well
    //   console.log({
    //     id: x.id,
    //     location: x.location,
    //     flap: x.flap,
    //     user: x.user,
    //     vectorClock: x.vectorClock,
    //     smurp: x.smurp,
    //   })
    //   break
    // }

    console.log('MAKING THE BASED NODES', Date.now() - xxx, 'ms')

    console.log(bla)

    console.log(result.buffer.byteLength)
  }

  await bla()

  // await wait(5000)

  // make new buffer if does not fit...

  // subscription map

  //

  /*
  {
    BUFFER 1mb // 4 bytes 
    [4]
  }
  */

  t.true(true)
})

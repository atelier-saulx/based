import test from 'ava'
import { wait } from '@saulx/utils'
import { dirname } from 'node:path'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

test('create server', async (t) => {
  const d = Date.now()

  const path = __dirname + '/tmp'
  try {
    await fs.rmdir(path, { recursive: true })
  } catch (err) {}
  await fs.mkdir(path)

  const db = new BasedDb({
    path,
  })

  const schema = db.updateSchema({
    types: {
      vote: {
        fields: {
          vectorClock: { type: 'integer' },
          value: {
            type: 'integer',
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
          snurp: {
            type: 'object',
            properties: {
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

  console.info(
    await db.set({
      type: 'vote',
      value: {
        value: 100,
      },
    }),
  )

  await wait(1e3)

  t.pass()
})

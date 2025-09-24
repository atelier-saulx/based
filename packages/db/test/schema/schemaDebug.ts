import { serverChildProcess } from '../shared/serverChildProcess.js'
import { DbClient, DbClientHooks, DbServer } from '../../src/index.js'
import test from '../shared/test.js'
import { deepCopy, deepMerge, wait } from '@based/utils'
import { copy, emptyDir } from 'fs-extra/esm'
import { deepEqual, equal } from '../shared/assert.js'

const cleanProps = (props) => {
  for (const i in props) {
    if (i[0] === '_') {
      delete props[i]
    } else if (props[i].prop?.[0] === '_') {
      delete props[i].prop
    } else if (props[i].items?.prop?.[0] === '_') {
      delete props[i].items.prop
    } else {
      const nested = props[i].props || props[i].items?.props
      if (nested) {
        cleanProps(nested)
      }
    }
  }
  delete props.id
}

const removeInverseProps = (props) => {
  for (const i in props) {
    delete props[i].prop
    const nested = props[i].props || props[i].items?.props
    if (nested) {
      removeInverseProps(nested)
    }
  }
}

const cleanSchema = (schema: DbServer['schema']) => {
  const schemaCopy = deepCopy(schema)

  delete schemaCopy.lastId
  delete schemaCopy.hash

  for (const type in schemaCopy.types) {
    cleanProps(schemaCopy.types[type].props)
    if (type === '_root') {
      // @ts-ignore
      schemaCopy.props = schemaCopy.types[type].props
      removeInverseProps(schemaCopy.props)
      delete schemaCopy.types[type]
    }
  }
  return schemaCopy
}

await test('schema debug', async (t) => {
  await emptyDir(t.tmp)
  try {
    await copy('test/shared/tmp/debug', t.tmp)
  } catch (e) {
    console.info('no debug found, skip')
    return
  }

  const server = serverChildProcess(t.tmp)
  const hooks: DbClientHooks = {
    subscribe() {
      console.warn('No sub hook here for reasons in multi / test')
      return () => {}
    },
    subscribeSchema: (setSchema) => {
      if (server.schema) {
        setSchema(server.schema)
      }
      server.on('schema', (schema) => {
        setSchema(schema)
      })
    },
    async setSchema(schema, transformFns) {
      const res = await server.setSchema(schema, transformFns)
      return res
    },
    flushModify(buf) {
      return Promise.resolve(server.modify(new Uint8Array(buf)))
    },
    async getQueryBuf(buf) {
      buf = new Uint8Array(buf)
      return server.getQueryBuf(buf)
    },
  }
  const client = new DbClient({ hooks })
  t.after(() => server.destroy())
  await server.start()
  const schema = cleanSchema(client.schema || (await client.once('schema')))

  let i = 1
  while (i--) {
    const contestants = await client.query('contestant').get().toObject()

    await client.setSchema(
      deepMerge(schema, {
        types: {
          contestant: {
            props: {
              extraField: 'string',
            },
          },
        },
      }),
    )

    for (const contestant of contestants) {
      await client.update('contestant', contestant.id, {
        extraField: 'field' + contestant.id,
      })
    }

    await client.setSchema(
      deepMerge(schema, {
        types: {
          contestant: {
            props: {
              extraField: 'string',
              anotherField: 'number',
            },
          },
        },
      }),
    )

    for (const contestant of contestants) {
      await client.update('contestant', contestant.id, {
        anotherField: Math.random(),
      })
    }

    const clone = deepMerge(schema)
    delete clone.types.contestant.props.extraField
    await client.setSchema(clone)

    await wait(500)

    await client.setSchema(
      deepMerge(schema, {
        types: {
          contestant: {
            props: {
              extraField: 'string',
              anotherField: {
                transform: (value) => value * 2,
              },
            },
          },
        },
      }),
    )

    await wait(500)
  }
})

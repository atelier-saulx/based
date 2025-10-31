import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { Schema } from '@based/schema'
import { deepCopy, deepMerge } from '@based/utils'

await test('migrate edges', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  const schema: Schema = {
    locales: { en: {} },
    types: {
      game: {
        status: ['draft', 'scheduled'],
      },
      activeMachine: {
        games: {
          items: {
            ref: 'game',
            prop: 'activeMachines',
            $cnt: 'uint32',
          },
        },
      },
    },
  }

  await db.setSchema(schema)

  const machine = await db.create('activeMachine', {})

  const game = await db.create('game', {
    activeMachines: [{ id: machine, $cnt: 1 }],
  })

  const newSchema = deepMerge(deepCopy(schema), {
    types: {
      game: {
        uniqueDevices: 'uint32',
      },
    },
  })

  await db.setSchema(newSchema)

  console.log('set all items', await db.query('game').include('*', '**').get())

  await db.save()
  console.log('set all items', await db.drain())
})

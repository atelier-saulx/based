// use realworld data
import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { schema } from './shared/schema.js'
import { time, log, timeEnd } from './shared/utils.js'
import { parseData } from './shared/parseData.js'

await test('based', async (t) => {
  const map = await parseData()
  if (!map) return
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  db.putSchema(schema)

  const start = Date.now()

  // time('create')

  const refMap = {}
  for (const type in map) {
    const { data } = map[type]
    for (const node of data) {
      node._id = db.create(type, node.data).tmpId
      if (node.id) {
        refMap[type] ??= {}
        refMap[type][node.id] = node._id
      }
    }
  }

  // const d = db.drain()

  // timeEnd()
  // log('create drain: ' + d / 1e3 + 's')

  // time('set refs')
  let refCnt = 0
  let updates = 0

  for (const type in map) {
    const { data, refProps } = map[type]
    for (const node of data) {
      for (const key in refProps) {
        const { refType, refProp } = refProps[key]
        const val = node.data[key]
        if (val in refMap[refType]) {
          node._refs ??= {}
          node._refs[refProp] = refMap[refType][val]
          refCnt++
        }
      }
      if (node._refs) {
        updates++
        db.update(type, node._id, node._refs)
      }
    }
  }

  const d2 = db.drain()
  // timeEnd()
  log('set refs drain: ' + d2 / 1e3 + 's', { updates, refCnt })

  const end = Date.now()

  console.log('TIME SPENT:', end - start) // 14748

  console.log(
    'RES:',
    db
      .query('club')
      .include(
        '*',
        'outgoing_transfers',
        'incoming_transfers',
        'domestic_competition',
        'home_games',
        'away_games',
        'players',
        'valuations',
        'game_events',
        'appearances',
        'game_lineups',
      )
      .range(0, 1)
      .get()
      .toObject(),
  )

  time('stop db')
  await db.stop(true)
  timeEnd()
})

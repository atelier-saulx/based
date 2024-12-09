// use realworld data
import { BasedDb } from '@based/db'
import { schema } from './shared/schema.js'
import { parseData } from './shared/parseData.js'
import { tmpdir } from 'os'
import { perf } from '../utils.js'

const map = await parseData()
if (map) {
  const db = new BasedDb({
    path: tmpdir(),
    maxModifySize: 5000,
  })

  await db.start({ clean: true })

  const schemaPerf = perf('insert schema')
  db.putSchema(schema)
  schemaPerf()

  const insertPerf = perf('insert nodes')
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

  console.time('drain')
  const drainTime = db.drain()
  console.timeEnd('drain')
  insertPerf()
  perf('insert drain', drainTime / 1e3)

  // console.log(db.query('club').get().toObject())
  await db.destroy()
}

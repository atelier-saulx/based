import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { schema, types } from './schema.js'
import { dir, time, log, num, timeEnd } from './utils.js'

const parseVal = (prop, value) => {
  if (prop === 'string') {
    return value || ''
  } else if (prop === 'boolean') {
    return Boolean(value)
  } else if (prop === 'timestamp') {
    return new Date(value).getTime()
  } else {
    return Number(value)
  }
}

const parseCsv = (type, csv, map, idKey) => {
  const { props } = schema.types[type]
  const [header, ...rows] = csv.split('\n')
  const keys = header.split(',')

  return rows.map((row) => {
    const values = row.split(',')
    const data = {}
    let i = keys.length
    while (i--) {
      const key = keys[i]
      const prop = props[key]
      data[key] = parseVal(prop, values[i])
    }

    const id = data[idKey]
    if (id) {
      map[id] = data
    }
    return { id, data }
  })
}

export const parseData = async () => {
  const files = await readdir(dir).catch((e) => {})
  if (!files) {
    console.info('no files for transfermarkt test, skipping...')
    return
  }

  let amount = 0

  time('read')

  const map = {}
  await Promise.all(
    files.map(async (file) => {
      if (file.endsWith('.csv')) {
        const type = file.slice(0, -5)
        if (type in schema.types) {
          const idKey = type + '_id'
          const m = {}
          const buff = await readFile(join(dir, file))
          const data = parseCsv(type, buff.toString(), m, idKey)

          amount += data.length

          const head = data[0].data
          const { props } = schema.types[type]
          const refProps = {}
          for (const key in head) {
            if (key.endsWith('_id')) {
              const refProp = key.slice(0, -3)
              if (refProp in props) {
                // @ts-ignore
                const refType = props[refProp].ref
                refProps[key] = { refProp, refType }
              }
            }
          }

          map[type] = { data, refProps, map: m, idKey }
        }
      }
    }),
  )

  const added = {}
  for (const type of types) {
    const { data, refProps } = map[type]
    const { props } = schema.types[type]
    for (const node of data) {
      for (const key in refProps) {
        const { refType } = refProps[key]
        const val = node.data[key]
        if (val && !(val in map[refType].map)) {
          const item = {
            [map[refType].idKey]: parseVal(props[key], val),
          }

          map[refType].data.push({ id: val, data: item })
          map[refType].map[val] = item

          let name
          if (key === 'from_club_id') {
            name = node.data.from_club_name
          } else if (key === 'to_club_id') {
            name = node.data.to_club_name
          } else if (key === 'home_club_id') {
            name = node.data.home_club_name
          } else if (key === 'away_club_id') {
            name = node.data.away_club_name
          } else if (key === 'player_id') {
            name = node.data.player_name
          }

          if (name) {
            item.name = name
          }

          added[type] ??= {}
          added[type][refType] ??= 0
          added[type][refType]++
          amount++
        }
      }
    }
  }

  log()
  log('total: ' + num(amount))
  timeEnd()

  return map
}

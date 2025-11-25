import repl from 'node:repl'
import { fileURLToPath } from 'url'
import { join, dirname, resolve } from 'path'
import { BasedDb, BasedQueryResponse } from '../dist/src/index.js'
import { formatTable } from '../dist/src/table.js'
import { PropType, type PropTypeEnum } from '../dist/src/zigTsExports.js'
import { AggregateType } from '../dist/src/protocol/index.js'
import { readDoubleLE, readUint32 } from '../dist/src/utils/index.js'
const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const defaultDataPath = resolve(join(__dirname, '../tmp'))
let dataPath = defaultDataPath

if (process.argv.length >= 3) {
  dataPath = process.argv[process.argv.length - 1]
}

console.log(`path: ${dataPath}`)

const typeIndex2Align = {
  [PropType.null]: 'l',
  [PropType.timestamp]: 'r',
  [PropType.number]: '.',
  [PropType.cardinality]: 'r',
  [PropType.int8]: 'r',
  [PropType.uint8]: 'r',
  [PropType.int16]: 'r',
  [PropType.uint16]: 'r',
  [PropType.int32]: 'r',
  [PropType.uint32]: 'r',
  [PropType.boolean]: 'c',
  [PropType.enum]: 'c',
  [PropType.string]: 'l',
  [PropType.text]: 'l',
  [PropType.reference]: 'l',
  [PropType.references]: 'l',
  [PropType.microBuffer]: 'l',
  [PropType.alias]: 'l',
  [PropType.aliases]: 'l',
  [PropType.binary]: 'l',
  [PropType.vector]: 'l',
  [PropType.json]: 'l',
  [PropType.object]: 'l',
  [PropType.colVec]: 'l',
}

async function tabled(
  response: Promise<BasedQueryResponse> | BasedQueryResponse,
) {
  // @ts-ignore
  const r: BasedQueryResponse = response.then ? await response : response

  let title: string
  if (r.def.type === 1) {
    if (r.def.target.ref?.path) {
      title = r.def.target.ref.path.join('.')
    } else {
      title = 'null'
    }
  } else {
    title = r.def.target.type
  }

  if (r.def.type !== 4) {
    console.error('Not implemented')
    return
  }

  const schema = r.def.schema
  if (!schema) {
    console.error('No schema')
    return
  }

  const header: string[] = []
  const align: Array<'l' | 'r' | 'c' | '.'> = []
  const data: { name: string; rows: (string | number)[][] }[] = [
    {
      name: title,
      rows: [],
    },
  ]

  if (r.def.aggregate) {
    if (r.def.aggregate.groupBy) {
      // TODO groupBy
    } else if (r.def.aggregate.aggregates) {
      for (const ary of r.def.aggregate.aggregates.values()) {
        const row: Array<string | number> = []
        for (const agg of ary) {
          // Update the header
          const hdr = `${agg.propDef.path!.join('.')} (${AggregateType[agg.type].toLowerCase()})`
          const idx = !header.includes(hdr)
            ? header.push(hdr) - 1
            : header.indexOf(hdr)

          if (
            agg.type === AggregateType.CARDINALITY ||
            agg.type === AggregateType.COUNT
          ) {
            const offset = 0
            row[idx] = readUint32(r.result, agg.resultPos + offset)
          } else {
            const offset = 0
            row[idx] = readDoubleLE(r.result, agg.resultPos + offset)
          }
        }
        data[0].rows.push(row)
      }
    }
  } else {
    header.push('ID')
    align.push('r')
    for (const k of Object.keys(schema.props)) {
      const prop = schema.props[k]
      header.push(prop.path.join('.'))
      // @ts-ignore
      align.push(typeIndex2Align[prop.typeIndex])
    }
    r.forEach((v: any) => {
      data[0].rows.push([
        v.id,
        ...Object.keys(schema.props).map((k) => {
          const value = k.includes('.')
            ? k.split('.').reduce((acc, cur) => acc[cur], v)
            : v[k]
          if (schema.props[k].typeIndex === PropType.text) {
            return JSON.stringify(value)
          }
          return `${value}`
        }),
      ])
    })
  }

  console.log(formatTable(header, align, data))
}

function initializeContext(context: any) {
  if (context.db) {
    context.db.stop(true)
  }

  const db = new BasedDb({
    path: dataPath,
  })
  db.start({})
  Object.defineProperty(context, 'db', {
    configurable: true,
    enumerable: true,
    value: db,
  })
  Object.defineProperty(context, 'tabled', { value: tabled })
}

console.log('Type .help for help')
const r = repl.start('based > ')
r.defineCommand('savedb', {
  help: 'Save the DB',
  action() {
    this.context.db.save().then(() => this.displayPrompt())
  },
})
r.defineCommand('schema', {
  help: "Print the current schema (args: ['short'])",
  action(arg) {
    const types = this.context.db.server?.schema?.types
    if (arg === 'short') {
      for (const name of Object.keys(types)) {
        console.log(`${name}: ${types[name].id}`)
      }
    } else {
      console.dir(types, { depth: 100 })
    }
  },
})
r.on('reset', initializeContext)
initializeContext(r.context)

import repl from 'node:repl'
import { fileURLToPath } from 'url'
import { join, dirname, resolve } from 'path'
import { BasedDb, BasedQueryResponse } from '../dist/src/index.js'
import { formatTable } from '../dist/src/table.js'
import {
  ALIAS,
  ALIASES,
  BINARY,
  BOOLEAN,
  CARDINALITY,
  COLVEC,
  ENUM,
  INT16,
  INT32,
  INT8,
  MICRO_BUFFER,
  NULL,
  NUMBER,
  OBJECT,
  REFERENCE,
  REFERENCES,
  STRING,
  TEXT,
  TIMESTAMP,
  UINT16,
  UINT32,
  UINT8,
  VECTOR,
  JSON as SCHEMA_JSON,
} from '@based/schema/def'
import { readDoubleLE, readUint32 } from '@based/utils'
import {AggregateType} from '@based/protocol/db-read'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const defaultDataPath = resolve(join(__dirname, '../tmp'))
let dataPath = defaultDataPath

if (process.argv.length >= 3) {
  dataPath = process.argv[process.argv.length - 1]
}
console.log(`path: ${dataPath}`)

const typeIndex2Align = {}
typeIndex2Align[NULL] = 'l'
typeIndex2Align[TIMESTAMP] = 'r'
typeIndex2Align[NUMBER] = '.'
typeIndex2Align[CARDINALITY] = 'r'
typeIndex2Align[INT8] = 'r'
typeIndex2Align[UINT8] = 'r'
typeIndex2Align[INT16] = 'r'
typeIndex2Align[UINT16] = 'r'
typeIndex2Align[INT32] = 'r'
typeIndex2Align[UINT32] = 'r'
typeIndex2Align[BOOLEAN] = 'c'
typeIndex2Align[ENUM] = 'c'
typeIndex2Align[STRING] = 'l'
typeIndex2Align[TEXT] = 'l'
typeIndex2Align[REFERENCE] = 'l'
typeIndex2Align[REFERENCES] = 'l'
typeIndex2Align[MICRO_BUFFER] = 'l'
typeIndex2Align[ALIAS] = 'l'
typeIndex2Align[ALIASES] = 'l'
typeIndex2Align[BINARY] = 'l'
typeIndex2Align[VECTOR] = 'l'
typeIndex2Align[SCHEMA_JSON] = 'l'
typeIndex2Align[OBJECT] = 'l'
typeIndex2Align[COLVEC] = 'l'

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
          const hdr = `${agg.propDef.path.join('.')} (${AggregateType[agg.type].toLowerCase()})`
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
      align.push(typeIndex2Align[prop.typeIndex])
    }
    r.forEach((v) => {
      data[0].rows.push([
        v.id,
        ...Object.keys(schema.props).map((k) => {
          const value = k.includes('.')
            ? k.split('.').reduce((acc, cur) => acc[cur], v)
            : v[k]
          if (schema.props[k].typeIndex === TEXT) {
            return JSON.stringify(value)
          }
          return `${value}`
        }),
      ])
    })
  }

  console.log(formatTable(header, align, data))
}

function initializeContext(context) {
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
  help: 'Print the current schema',
  action() {
    console.dir(this.context.db.server?.schema?.types, { depth: 100 })
  }
})
r.on('reset', initializeContext)
initializeContext(r.context)

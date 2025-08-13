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
  META_SELVA_STRING,
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
  WEAK_REFERENCE,
  WEAK_REFERENCES,
} from '@based/schema/def'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

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

  const typeIndex2Align = {
    NULL: 'l',
    TIMESTAMP: 'r',
    NUMBER: '.',
    CARDINALITY: 'r',
    INT8: 'r',
    UINT8: 'r',
    INT16: 'r',
    UINT16: 'r',
    INT32: 'r',
    UINT32: 'r',
    BOOLEAN: 'c',
    ENUM: 'c',
    STRING: 'l',
    TEXT: 'l',
    REFERENCE: 'l',
    REFERENCES: 'l',
    WEAK_REFERENCE: 'l',
    WEAK_REFERENCES: 'l',
    MICRO_BUFFER: 'l',
    ALIAS: 'l',
    ALIASES: 'l',
    BINARY: 'l',
    VECTOR: 'l',
    JSON: 'l',
    OBJECT: 'l',
    COLVEC: 'l',
    META_SELVA_STRING: 'l',
  }

  const header = ['ID']
  const align: Array<'l' | 'r' | 'c' | '.'> = ['r']
  for (const k of Object.keys(schema.props)) {
    const prop = schema.props[k]
    header.push(prop.path.join('.'))
    align.push(typeIndex2Align[prop.typeIndex])
  }
  const data: { name: string; rows: (string | number)[][] }[] = [
    {
      name: title,
      rows: [],
    },
  ]
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

  console.log(formatTable(header, align, data))
}

function initializeContext(context) {
  const db = new BasedDb({
    path: resolve(join(__dirname, '../tmp')),
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
r.on('reset', initializeContext)
initializeContext(r.context)

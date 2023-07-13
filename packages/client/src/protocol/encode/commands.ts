import { Command } from '../types'
import { defaultEncoder, strEncoder } from './defaultEncoder'
import { modify } from './modify'

type CommandEncoders = Record<Command, (payload: any) => Buffer | null>

export const COMMAND_ENCODERS: CommandEncoders = {
  // system commands
  echo: strEncoder(1),
  ping: null,
  lscmd: null,
  debug: null,
  flush: null,
  save: strEncoder(1),
  load: strEncoder(1),
  lsaliases: null,
  replicasync: null,
  replicaof: strEncoder(2), // ip, port
  replicainfo: null,
  replicawait: null,
  // essential
  'resolve.nodeid': strEncoder(1), // concatenated ID strings in 1 arg
  publish: defaultEncoder([
    { type: 'longlong' }, // channel id
    { type: 'string' }, // msg
  ]),
  subscribe: defaultEncoder([
    { type: 'longlong' }, // channel id
  ]),
  unsubscribe: defaultEncoder([
    { type: 'longlong' }, // channel id
  ]),
  // indexes
  'index.list': null,
  // object primitives
  'object.set': defaultEncoder([
    { type: 'id' },
    // field
    { type: 'string' },
    // valueId
    { type: 'string' },
    // value
    { type: 'string' },
  ]),

  'object.get': defaultEncoder([
    { type: 'string' }, // lang
    { type: 'id' },
    { type: 'string', vararg: true }, // ...fields
  ]),
  'object.del': defaultEncoder([
    { type: 'id' },
    { type: 'string' }, // fieldName
  ]),
  'object.exists': defaultEncoder([
    { type: 'id' },
    { type: 'string' }, // fieldName
  ]),
  'object.len': defaultEncoder([
    { type: 'id' },
    { type: 'string' }, // fieldName
  ]),
  'object.setMeta': defaultEncoder([
    { type: 'id' },
    { type: 'string' }, // fieldName
    { type: 'string' }, // meta value
  ]),
  // modify related commands
  modify,
  // hierarchy
  'hierarchy.find': (payload) => {
    return Buffer.from('hello')
  },
  'hierarchy.edgeList': defaultEncoder([
    { type: 'id' },
    // field name
    { type: 'string' },
  ]),
  'hierarchy.parents': defaultEncoder([{ type: 'id' }]),
  'hierarchy.children': defaultEncoder([{ type: 'id' }]),
}

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
  'resolve.nodeid': defaultEncoder([
    { type: 'string' }, // sub id
    { type: 'string', vararg: true }, // ...(id | alias)
  ]),
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
  'object.incrby': defaultEncoder([
    { type: 'id' },
    { type: 'string' }, // fieldName
    { type: 'longlong' }, // incrby
  ]),
  'object.incrbydouble': defaultEncoder([
    { type: 'id' },
    { type: 'string' }, // fieldName
    { type: 'double' }, // incrby
  ]),
  'object.keys': defaultEncoder([
    { type: 'id' },
    { type: 'string' }, // fieldName (optional)
  ]),
  // modify related commands
  modify,
  // hierarchy
  'hierarchy.del': defaultEncoder([
    { type: 'string' }, // flags
    { type: 'string', vararg: true }, // ... nodeID
  ]),
  'hierarchy.addConstraint': strEncoder(4), // <src node type>,<contraint flags>,<fwd field name>,<bck field name>
  'hierarchy.find': defaultEncoder([
    { type: 'string' }, // lang
    { type: 'bin' }, // find query opts (
    { type: 'string' }, // ids (concatenated)
    { type: 'string' }, // filter expr (RPN string)
    { type: 'string', vararg: true }, // filter args
  ]),
  'hierarchy.edgeList': defaultEncoder([
    { type: 'id' },
    // field name
    { type: 'string' },
  ]),
  'hierarchy.parents': defaultEncoder([{ type: 'id' }]),
  'hierarchy.children': defaultEncoder([{ type: 'id' }]),
}

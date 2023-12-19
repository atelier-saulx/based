import { Command } from '../types'
import { defaultEncoder, strEncoder } from './defaultEncoder'
import { modify } from './modify'
import { update } from './update'

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
  replicaof: defaultEncoder([
    { type: 'longlong' }, // port
    { type: 'string', }, // ip
  ]),
  replicainfo: null,
  replicawait: defaultEncoder([
    { type: 'longlong' }, // ?timeout [sec],
  ]),
  rusage: null,
  // essential
  'resolve.nodeid': defaultEncoder([
    { type: 'longlong' }, // sub id
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
  'index.del': defaultEncoder([
    { type: 'string' }, // index name
    { type: 'longlong' }, // ?discard
  ]),
  'index.new': defaultEncoder([
    { type: 'longlong' }, // SelvaTraversal
    { type: 'string' }, // ref field
    { type: 'longlong' }, // SelvaResultOrder
    { type: 'string' }, // order field
    { type: 'id' }, // nodeId
    { type: 'string' }, // filter
  ]),
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
  'object.getMeta': defaultEncoder([
    { type: 'id' },
    { type: 'string' }, // fieldName
  ]),
  'object.setMeta': defaultEncoder([
    { type: 'id' },
    { type: 'string' }, // fieldName
    { type: 'longlong' }, // meta value
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
  update,
  // hierarchy
  'hierarchy.types.add': defaultEncoder([
    { type: 'string' }, // prefix
    { type: 'string' }, // type name
  ]),
  'hierarchy.types.clear': null,
  'hierarchy.types.list': null,
  'hierarchy.del': defaultEncoder([
    { type: 'string' }, // flags
    { type: 'string', vararg: true }, // ... nodeID
  ]),
  'hierarchy.expire': defaultEncoder([
    { type: 'id' },
    { type: 'longlong' }, // ts
  ]),
  'hierarchy.addConstraint': strEncoder(4), // <src node type>,<contraint flags>,<fwd field name>,<bck field name>
  'hierarchy.listConstraints': null,
  'hierarchy.find': defaultEncoder([
    { type: 'string' }, // lang
    { type: 'bin' }, // find query opts (
    { type: 'string' }, // ids (concatenated)
    { type: 'string' }, // filter expr (RPN string)
    { type: 'string', vararg: true }, // filter args
  ]),
  'hierarchy.aggregate': defaultEncoder([
    { type: 'string' }, // lang
    { type: 'bin' }, // agg query opts
    { type: 'string' }, // ids (concatenated)
    { type: 'string' }, // fields_raw (function args)
    { type: 'string' }, // filter expr (RPN string)
    { type: 'string', vararg: true }, // filter args
  ]),
  'hierarchy.edgeList': defaultEncoder([
    { type: 'id' },
    // field name
    { type: 'string' },
  ]),
  'hierarchy.edgeGet': defaultEncoder([
    { type: 'id' },
    // field name
    { type: 'string' },
  ]),
  'hierarchy.parents': defaultEncoder([{ type: 'id' }]),
  'hierarchy.children': defaultEncoder([{ type: 'id' }]),
  'subscriptions.addMarker': defaultEncoder([
    { type: 'longlong' }, // subId
    { type: 'longlong' }, // markerId
    { type: 'bin' }, // find query opts
    { type: 'string' }, // ids (concatenated)
    { type: 'string' }, // fields str
    { type: 'string' }, // filter expr (RPN string)
    { type: 'string', vararg: true }, // filter args
  ]),
  'subscriptions.addAlias': defaultEncoder([
    { type: 'longlong' }, // subId
    { type: 'longlong' }, // markerId
    { type: 'string' }, // alias
  ]),
  'subscriptions.list': defaultEncoder([
    { type: 'longlong' }
  ]),
  'subscriptions.debug': defaultEncoder([
    { type: 'string' }, // subId as string
  ]),
  'subscriptions.refresh': defaultEncoder([
    { type: 'longlong' }, // subId
  ]),
  'subscriptions.refreshMarker': defaultEncoder([
    { type: 'longlong' }, // markerId
  ]),
  'subscriptions.del': defaultEncoder([
    { type: 'longlong' }, // subId
  ]),
  'subscriptions.delmarker': defaultEncoder([
    { type: 'longlong' }, // subId
    { type: 'longlong' }, // markerId
  ]),
  'rpn.evalBool': defaultEncoder([
    { type: 'string' }, // key
    { type: 'string' }, // expression
    { type: 'string', vararg: true }, // regs
  ]),
  'rpn.evalDouble': defaultEncoder([
    { type: 'string' }, // key
    { type: 'string' }, // expression
    { type: 'string', vararg: true }, // regs
  ]),
  'rpn.evalString': defaultEncoder([
    { type: 'string' }, // key
    { type: 'string' }, // expression
    { type: 'string', vararg: true }, // regs
  ]),
  'rpn.evalSet': defaultEncoder([
    { type: 'string' }, // key
    { type: 'string' }, // expression
    { type: 'string', vararg: true }, // regs
  ]),
}

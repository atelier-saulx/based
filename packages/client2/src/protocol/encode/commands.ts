import { Command } from '../types.js'
import { defaultEncoder, strEncoder } from './defaultEncoder.js'
import { modify } from './modify/index.js'

type CommandEncoders = Record<Command, (payload: any) => Buffer | null>

export const COMMAND_ENCODERS: CommandEncoders = {
  // system commands
  ping: null,
  echo: strEncoder(1),
  lscmd: null,
  hrt: null,
  lslang: null,
  lsmod: null,
  config: null,
  loglevel: defaultEncoder([{ type: 'longlong' }]),
  debug: defaultEncoder([{ type: 'string' }]),
  mallocstats: defaultEncoder([{ type: 'string' }]),
  mallocprofdump: defaultEncoder([
    { type: 'string' }, // opt filename
  ]),
  ver: null,
  rusage: null,
  client: defaultEncoder([{ type: 'string' }]),
  load: strEncoder(1),
  save: strEncoder(1),
  flush: null,
  purge: defaultEncoder([
    { type: 'longlong' }, // n
  ]),
  replicasync: null,
  replicaof: defaultEncoder([
    { type: 'longlong' }, // port
    { type: 'string' }, // ip
  ]),
  replicainfo: null,
  replicawait: defaultEncoder([
    { type: 'longlong' }, // ?timeout [sec],
  ]),
  // essential
  'resolve.nodeid': defaultEncoder([
    { type: 'longlong' }, // sub id
    { type: 'string', vararg: true }, // ...(id | alias)
  ]),
  lsaliases: null,
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
  'index.new': defaultEncoder([
    { type: 'longlong' }, // SelvaTraversal
    { type: 'string' }, // ref field
    { type: 'longlong' }, // SelvaResultOrder
    { type: 'string' }, // order field
    { type: 'id' }, // nodeId
    { type: 'string' }, // filter
  ]),
  'index.del': defaultEncoder([
    { type: 'string' }, // index name
    { type: 'longlong' }, // ?discard
  ]),
  'index.debug': defaultEncoder([{ type: 'string' }]),
  // object primitives
  'object.type': defaultEncoder([{ type: 'id' }, { type: 'string' }]),
  'object.get': defaultEncoder([
    { type: 'string' }, // lang
    { type: 'id' },
    { type: 'string', vararg: true }, // ...fields
  ]),
  'object.getString': defaultEncoder([{ type: 'id' }, { type: 'string' }]),
  'object.set': defaultEncoder([
    { type: 'id' },
    // field
    { type: 'string' },
    // valueId
    { type: 'string' },
    // value
    { type: 'string' },
  ]),
  'object.cas': defaultEncoder([
    { type: 'id' },
    // field
    { type: 'string' },
    // old crc
    { type: 'longlong' },
    // new value
    { type: 'string' },
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
  // hierarchy
  'hierarchy.schema.set': defaultEncoder([
    { type: 'string', vararg: true }, // node schema
  ]),
  'hierarchy.schema.get': null,
  'hierarchy.del': defaultEncoder([
    { type: 'string' }, // flags
    { type: 'string', vararg: true }, // ... nodeID
  ]),
  'hierarchy.expire': defaultEncoder([
    { type: 'id' },
    { type: 'longlong' }, // ts
  ]),
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
  'hierarchy.edgeGetMetadata': defaultEncoder([
    { type: 'id' },
    { type: 'string' }, // field
    { type: 'id' }, // dst
  ]),
  'hierarchy.heads': null,
  'hierarchy.compress': defaultEncoder([{ type: 'id' }, { type: 'longlong' }]),
  'hierarchy.listCompressed': null,
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
  'subscriptions.addTrigger': defaultEncoder([
    { type: 'longlong' }, // subId
    { type: 'longlong' }, // markerId
    { type: 'longlong' }, // event type
    { type: 'string' }, // filter expr (RPN string)
    { type: 'string', vararg: true }, // filter args
  ]),
  'subscriptions.list': defaultEncoder([{ type: 'longlong' }]),
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
  'subscriptions.delMarker': defaultEncoder([
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
  'mq.create': defaultEncoder([
    { type: 'string' }, // name
    { type: 'longlong' }, // optional timeout
  ]),
  'mq.delete': defaultEncoder([
    { type: 'string' }, // name
  ]),
  'mq.list': null,
  'mq.post': defaultEncoder([
    { type: 'string' }, // name
    { type: 'string', vararg: true }, // messages
  ]),
  'mq.recv': defaultEncoder([
    { type: 'string' }, // name
    { type: 'longlong' }, // min
    { type: 'longlong' }, // max
    { type: 'longlong' }, // timeout
  ]),
  'mq.ack': defaultEncoder([
    { type: 'string' }, // name
    { type: 'longlong' }, // msg_id
  ]),
  'mq.nack': defaultEncoder([
    { type: 'string' }, // name
    { type: 'longlong' }, // msg_id
  ]),
  pipe: null, // TODO pipe is raw data
}

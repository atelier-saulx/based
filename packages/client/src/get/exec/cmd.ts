import { CompiledRecordDef, createRecord } from 'data-record'
import { protocol } from '../..'
import {
  Command,
  SelvaHierarchy_AggregateType,
  SelvaResultOrder,
  SelvaTraversal,
} from '../../protocol'
import { makeLangArg } from './lang'
import { ExecContext, GetCommand } from '../types'
import { sourceId } from '../id'
import { getFields } from './fields'
import { ast2rpn, bfsExpr2rpn, createAst } from '@based/db-query'
import { hashCmd } from '../util'

type CmdExecOpts = {
  cmdName: Command
  struct: any
  extraArgs?: any[]
  rpn: string[]
  cmdID: number
  nodeId: string
  fields: string
  strFields: string
  recordDef: CompiledRecordDef
}

const TRAVERSE_MODES: Record<string, protocol.SelvaTraversal> = {
  descendants: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
  ancestors: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
  children: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_CHILDREN,
  parents: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_PARENTS,
}

const RECURSIVE_TRAVERSE_MODES: Record<number, protocol.SelvaTraversal> = {
  [SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS]:
    SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
  [SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS]:
    SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
  [SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_CHILDREN]:
    SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
  [SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_PARENTS]:
    SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS,
  [SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD]:
    SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD,
  [SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_FIELD]:
    SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD,
}

const SORT_ORDERS: Record<string, SelvaResultOrder> = {
  asc: SelvaResultOrder.SELVA_RESULT_ORDER_ASC,
  desc: SelvaResultOrder.SELVA_RESULT_ORDER_DESC,
}

const AGGREGATE_FNS: Record<string, protocol.SelvaHierarchy_AggregateType> = {
  count: SelvaHierarchy_AggregateType.SELVA_AGGREGATE_TYPE_COUNT_NODE,
  countUnique:
    SelvaHierarchy_AggregateType.SELVA_AGGREGATE_TYPE_COUNT_UNIQUE_FIELD,
  sum: SelvaHierarchy_AggregateType.SELVA_AGGREGATE_TYPE_SUM_FIELD,
  avg: SelvaHierarchy_AggregateType.SELVA_AGGREGATE_TYPE_AVG_FIELD,
  min: SelvaHierarchy_AggregateType.SELVA_AGGREGATE_TYPE_MIN_FIELD,
  max: SelvaHierarchy_AggregateType.SELVA_AGGREGATE_TYPE_MAX_FIELD,
}

// DB event come in as: `<marker_id>:<sub_id1>,<sub_id2>,...`
// TODO: make it an LRU cache so we can do sanity checks on interval to see if we missed updates
const CMD_RESULT_CACHE: Map<number, any> = new Map()

export function purgeCache(cmdID: number): void {
  CMD_RESULT_CACHE.delete(cmdID)
}

export async function getCmd(ctx: ExecContext, cmd: GetCommand): Promise<any> {
  const { client, subId } = ctx

  const opts = await makeOpts(ctx, cmd)
  const { cmdID } = opts

  let result = subId ? CMD_RESULT_CACHE.get(cmdID) : undefined

  if (ctx.cleanup) {
    if (cmdID === ctx.markerId) {
      // skip cleanup, we need to refresh (just once per batch, so handled separately)
      return result
    }

    await client.command('subscriptions.delmarker', [ctx.subId, cmdID])

    // TODO: only clean cache if it hasn't been cleaned for this ID on this tick yet (if not cleaned by other SUB yet)
    CMD_RESULT_CACHE.delete(cmdID)
  } else {
    if (!result) {
      result = await execCmd(ctx, opts)
    }

    if (subId) {
      ctx.markers.push(opts)
      CMD_RESULT_CACHE.set(cmdID, result)
    }
  }

  if (cmd.type === 'ids' && cmd.nestedFind) {
    const ids = result?.[0]
    const { nestedFind } = cmd
    nestedFind.source = { idList: ids }
    nestedFind.markerId = hashCmd(nestedFind)
    return getCmd(ctx, nestedFind)
  }

  return result
}

async function execCmd(
  ctx: ExecContext,
  { cmdName, nodeId, struct, rpn, recordDef, extraArgs }: CmdExecOpts
): Promise<any> {
  const { client } = ctx

  console.dir(
    {
      op: {
        cmdName,
        args: [makeLangArg(ctx), struct, nodeId, ...(extraArgs || []), ...rpn],
      },
    },
    { depth: 9 }
  )

  const op = await client.command(cmdName, [
    makeLangArg(ctx),
    createRecord(recordDef, struct),
    nodeId,
    ...(extraArgs || []),
    ...rpn,
  ])

  return op
}

async function makeOpts(
  ctx: ExecContext,
  cmd: GetCommand
): Promise<CmdExecOpts> {
  const cmdID = cmd.markerId ?? cmd.cmdId

  if (cmd.source.alias && !cmd.source.id) {
    cmd.source.id = await ctx.client.command('resolve.nodeid', [
      0,
      cmd.source.alias,
    ])
  }

  const struct: any = {
    dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE,
    limit: BigInt(-1),
    skip: BigInt(0),
    offset: BigInt(0),
  }

  let rpn = ['#1']

  if (cmd.type !== 'node') {
    // traverse by field
    if (cmd.sourceField) {
      const mode = TRAVERSE_MODES[cmd.sourceField]
      const dir = mode || SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_FIELD

      struct.dir = cmd.recursive ? RECURSIVE_TRAVERSE_MODES[dir] : dir

      if (!mode) {
        // if edge or array field, supply field name
        struct.dir_opt_str = cmd.sourceField
      }
    } else if (cmd.source.idList) {
      // traverse id list
      struct.dir = SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE
    } else {
      // bfs expression traversal
      struct.dir = cmd.recursive
        ? SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION
        : SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_EXPRESSION
      struct.dir_opt_str = bfsExpr2rpn(
        ctx.client.schema.types,
        cmd.traverseExpr
      )
    }

    if (cmd.filter) {
      const ast = createAst(cmd.filter)
      if (ast) {
        rpn = ast2rpn(ctx.client.schema.types, ast, ctx.lang || '')
      }
    }

    if (cmd.paging) {
      struct.limit = BigInt(cmd.paging.limit)
      struct.offset = BigInt(cmd.paging.offset)
    }

    if (cmd.sort) {
      struct.order =
        SORT_ORDERS[cmd.sort.order] ?? SelvaResultOrder.SELVA_RESULT_ORDER_NONE

      struct.order_by_field_str = cmd.sort.field
    }
  }

  const nodeId = sourceId(cmd)

  if (cmd.type === 'aggregate') {
    struct.agg_fn = AGGREGATE_FNS[cmd.function.$name]

    const fields = (cmd.function.$args || []).join('\n')
    return {
      cmdName: 'hierarchy.aggregate',
      struct,
      nodeId,
      rpn,
      cmdID,
      fields,
      strFields: fields,
      recordDef: protocol.hierarchy_agg_def,
      extraArgs: [(cmd.function.$args || []).join('|')],
    }
  } else if (cmd.type === 'ids' && cmd.nestedFind) {
    struct.merge_strategy = protocol.SelvaMergeStrategy.MERGE_STRATEGY_NONE
    struct.res_type = protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_IDS

    return {
      cmdName: 'hierarchy.find',
      struct,
      nodeId,
      rpn,
      cmdID,
      fields: '',
      strFields: '',
      recordDef: protocol.hierarchy_find_def,
    }
  } else {
    const {
      fields,
      isRpn: fieldsRpn,
      isInherit,
      strFields,
    } = getFields(ctx, cmd.fields)
    struct.merge_strategy = protocol.SelvaMergeStrategy.MERGE_STRATEGY_NONE
    struct.res_opt_str = fields
    struct.res_type = isInherit
      ? protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_INHERIT_RPN
      : fieldsRpn
      ? protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS_RPN
      : protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS

    return {
      cmdName: 'hierarchy.find',
      struct,
      nodeId,
      rpn,
      cmdID,
      fields,
      strFields,
      recordDef: protocol.hierarchy_find_def,
    }
  }
}

import { CompiledRecordDef, createRecord } from 'data-record'
import { protocol } from '../../index.js'
import {
  Command,
  SelvaHierarchy_AggregateType,
  SelvaResultOrder,
  SelvaTraversal,
} from '../../protocol/index.js'
import { makeLangArg } from './lang.js'
import { ExecContext, GetCommand } from '../types.js'
import { sourceId } from '../id.js'
import { getFields } from './fields.js'
import { ast2rpn, ast2IndexHints, bfsExpr2rpn, createAst } from '@based/db-query'
import { hashCmd } from '../util.js'
import { inspect } from 'node:util'

type CmdExecOpts = {
  cmdName: Command
  struct: any
  extraArgs?: any[]
  rpn: string[]
  hasNow: boolean
  cmdID: number
  nodeId: string
  fields: string
  strFields: string
  recordDef: CompiledRecordDef
  cmd: GetCommand
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

export function addSubMarker(
  ctx: ExecContext,
  cmd: GetCommand,
  subCmd: GetCommand
) {
  const { client } = ctx

  if (ctx.cleanup) {
    const purged = client.purgeSubMarkerMapping(subCmd.cmdId)
    if (purged) {
      ctx.client
        .command('subscriptions.delMarker', [ctx.subId, subCmd.cmdId])
        .catch((_e) => {
          console.error('Error cleaning up marker', ctx.subId, subCmd.cmdId)
        })
    }
  } else {
    const added = client.addSubMarkerMapping(
      subCmd.cmdId,
      cmd.markerId || cmd.cmdId
    )

    if (added) {
      const marker = makeOpts(ctx, subCmd)
      ctx.markers?.push(marker)
    }
  }
}

export async function resolveNodeId(
  ctx: ExecContext,
  cmd: GetCommand,
  aliases: string[]
): Promise<string | undefined> {
  const [resolved] = await ctx.client.command('resolve.nodeid', [
    ctx.subId ?? 0,
    ...aliases,
  ])

  if (!resolved) {
    return
  }

  const [markerId, _name, nodeId] = resolved

  if (markerId) {
    ctx.client.addSubMarkerMapping(Number(markerId), cmd.markerId || cmd.cmdId)
  }

  return nodeId
}

export async function getCmd(
  ctx: ExecContext,
  cmd: GetCommand,
  setPending?: Function
): Promise<any> {
  const { client, subId } = ctx

  if (cmd.source.alias && !cmd.source.id) {
    cmd.source.id = await resolveNodeId(ctx, cmd, [cmd.source.alias])
  }

  const opts = makeOpts(ctx, cmd)
  const { cmdID } = opts

  let result = subId ? client.CMD_RESULT_CACHE.get(cmdID) : undefined

  if (ctx.cleanup) {
    if (cmdID === ctx.markerId) {
      // skip cleanup, we need to refresh (just once per batch, so handled separately)
      return result
    }

    try {
      await client.command('subscriptions.delMarker', [ctx.subId, cmdID])
    } catch (e) {
      console.error(
        'Error cleaning up marker',
        ctx.subId,
        cmdID,
        e.message,
        e.code
      )
    }

    // TODO: only clean cache if it hasn't been cleaned for this ID on this tick yet (if not cleaned by other SUB yet)
    client.CMD_RESULT_CACHE.delete(cmdID)
  } else {
    if (!result) {
      try {
        result = await execCmd(ctx, opts)
        if (!result?.[0]?.length && cmd.source.id && ctx.subId) {
          // if id missing, make markers
          await resolveNodeId(ctx, cmd, [cmd.source.id])
        }
      } catch (e) {
        result = []
        console.error('Error executing command', e, inspect(cmd, { depth: 3 }))
      }
    }

    if (subId) {
      ctx.markers?.push(opts)
      client.CMD_RESULT_CACHE.set(cmdID, result)
    }
  }

  if (cmd.type === 'ids' && cmd.nestedFind) {
    const ids = result?.[0]
    const { nestedFind } = cmd
    nestedFind.source = { idList: ids }
    nestedFind.markerId = hashCmd(nestedFind)

    if (setPending && subId && nestedFind.markerId === ctx.markerId) {
      setPending(nestedFind)
    }
    return getCmd(ctx, nestedFind)
  }

  return result
}

export async function execCmd(
  ctx: ExecContext,
  { cmdName, nodeId, struct, rpn, recordDef, extraArgs }: CmdExecOpts
): Promise<any> {
  const { client } = ctx

  const op = await client.command(cmdName, [
    makeLangArg(ctx),
    createRecord(recordDef, struct),
    nodeId,
    ...(extraArgs || []),
    ...rpn,
  ])

  return op
}

const nonIndexedFields = new Set(['node', 'ancestors'])

export function makeOpts(ctx: ExecContext, cmd: GetCommand): CmdExecOpts {
  const cmdID = cmd.markerId ?? cmd.cmdId

  const struct: any = {
    dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE,
    limit: BigInt(-1),
    skip: BigInt(0),
    offset: BigInt(0),
  }

  let rpn = ['#1']
  let hasNow = false

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
        cmd.traverseExpr! // TODO: handle undefined
      )
    }

    if (cmd.filter) {
      const ast = createAst(cmd.filter)

      if (ast) {
        if (ast.hasNow) {
          hasNow = true
        }

        rpn = ast2rpn(ctx.client.schema.types, ast, ctx.lang || '')

        if (!cmd.disableIndexing && typeof cmd.sourceField === 'string' && !nonIndexedFields.has(cmd.sourceField)) {
            struct.index_hints_str = ast2IndexHints(ctx.client.schema.types, ast).join('\0')
        }
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
      hasNow,
      cmdID,
      fields,
      strFields: fields,
      recordDef: protocol.hierarchy_agg_def,
      extraArgs: [(cmd.function.$args || []).join('|')],
      cmd,
    }
  } else if (cmd.type === 'ids') {
    struct.merge_strategy = protocol.SelvaMergeStrategy.MERGE_STRATEGY_NONE
    struct.res_type = protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_IDS

    return {
      cmdName: 'hierarchy.find',
      struct,
      nodeId,
      rpn,
      hasNow,
      cmdID,
      fields: '',
      strFields: '',
      recordDef: protocol.hierarchy_find_def,
      cmd,
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
      hasNow,
      cmdID,
      fields,
      strFields,
      recordDef: protocol.hierarchy_find_def,
      cmd,
    }
  }
}

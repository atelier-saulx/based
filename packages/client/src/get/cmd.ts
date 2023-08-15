import { createRecord } from 'data-record'
import { protocol } from '..'
import {
  SelvaHierarchy_AggregateType,
  SelvaResultOrder,
  SelvaTraversal,
} from '../protocol'
import { makeLangArg } from './lang'
import { ExecContext, GetCommand } from './types'
import { sourceId } from './id'
import { getFields } from './fields'
import { ast2rpn, bfsExpr2rpn, createAst } from '@based/db-query'
import { hashCmd } from './util'

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

export async function getCmd(ctx: ExecContext, cmd: GetCommand): Promise<any> {
  // TODO: check cache by `cmd.markerId ?? cmd.cmdId`

  const { client } = ctx

  if (cmd.source.alias && !cmd.source.id) {
    cmd.source.id = await ctx.client.command('resolve.nodeid', cmd.source.alias)
  }

  const struct: any = {
    dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE,
    limit: BigInt(-1),
    offset: BigInt(0),
  }

  let rpn = ['#1']

  if (cmd.type !== 'node') {
    // traverse by field
    if (cmd.sourceField) {
      const mode = TRAVERSE_MODES[cmd.sourceField]
      const dir = mode || SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD

      struct.dir = cmd.recursive ? RECURSIVE_TRAVERSE_MODES[dir] : dir

      if (!mode) {
        // if edge field, supply field name
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
    if (ctx.subId) {
      const buf = createRecord(protocol.hierarchy_find_def, struct)

      ctx.markers.push(
        client.command('subscriptions.add', [
          ctx.subId,
          cmd.markerId || cmd.cmdId,
          buf,
          nodeId,
          cmd.function.$args.join('\n'),
          ...rpn,
        ])
      )
    }

    struct.agg_fn = AGGREGATE_FNS[cmd.function.$name]

    const agg = await client.command('hierarchy.aggregate', [
      makeLangArg(ctx),
      createRecord(protocol.hierarchy_agg_def, struct),
      nodeId,
      (cmd.function.$args || []).join('|'),
      ...rpn,
    ])

    return agg
  } else if (cmd.type === 'ids' && cmd.nestedFind) {
    struct.merge_strategy = protocol.SelvaMergeStrategy.MERGE_STRATEGY_NONE
    struct.res_type = protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_IDS

    const buf = createRecord(protocol.hierarchy_find_def, struct)

    if (ctx.subId) {
      ctx.markers.push(
        client.command('subscriptions.add', [
          ctx.subId,
          cmd.markerId || cmd.cmdId,
          buf,
          nodeId,
          '',
          ...rpn,
        ])
      )
    }

    const find = await client.command('hierarchy.find', [
      makeLangArg(ctx),
      buf,
      nodeId,
      ...rpn,
    ])

    const ids = find[0]
    const { nestedFind } = cmd
    nestedFind.source = { idList: ids }

    nestedFind.markerId = hashCmd(nestedFind)
    return getCmd(ctx, nestedFind)
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

    const buf = createRecord(protocol.hierarchy_find_def, struct)
    if (ctx.subId) {
      ctx.markers.push(
        client.command('subscriptions.add', [
          ctx.subId,
          cmd.markerId || cmd.cmdId,
          buf,
          nodeId,
          strFields,
          ...rpn,
        ])
      )
    }

    const find = await client.command('hierarchy.find', [
      makeLangArg(ctx),
      buf,
      nodeId,
      ...rpn,
    ])

    return find
  }
}

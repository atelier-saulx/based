import { ExecContext, Field, Fields, GetCommand, Path } from './types'
import { BasedDbClient, protocol } from '..'
import { createRecord } from 'data-record'
import { ast2rpn, createAst, bfsExpr2rpn } from '@based/db-query'
import {
  SelvaTraversal,
  SelvaResultOrder,
  SelvaHierarchy_AggregateType,
} from '../protocol'
import { deepCopy, deepMergeArrays, setByPath } from '@saulx/utils'

export * from './types'
export * from './parse'

import { getFields } from './fields'
import { makeLangArg } from './lang'
import { sourceId } from './id'
import { parseGetOpts, parseGetResult } from './parse'

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

export function applyDefault(
  obj: any,
  { path, value }: { path: Path; value: any }
): void {
  for (let i = 0; i < path.length - 1; i++) {
    const part = path[i]
    if (!obj[part]) {
      const o = {}
      setByPath(o, path.slice(i + 1), value)
      obj[part] = o
      return
    }

    obj = obj[part]

    if (Array.isArray(obj)) {
      obj.forEach((x) => applyDefault(x, { path: path.slice(i + 1), value }))
      return
    }
  }

  const last = path[path.length - 1]
  if (obj[last] === undefined) {
    obj[last] = value
  }
}

export async function getCmd(ctx: ExecContext, cmd: GetCommand): Promise<any> {
  if (cmd.source.alias && !cmd.source.id) {
    cmd.source.id = await ctx.client.command('resolve.nodeid', cmd.source.alias)
  }

  const { client } = ctx

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

  if (cmd.type === 'aggregate') {
    struct.agg_fn = AGGREGATE_FNS[cmd.function.$name]

    const agg = await client.command('hierarchy.aggregate', [
      makeLangArg(ctx),
      createRecord(protocol.hierarchy_agg_def, struct),
      sourceId(cmd),
      (cmd.function.$args || []).join('|'),
      ...rpn,
    ])

    return agg
  } else if (cmd.type === 'ids' && cmd.nestedFind) {
    struct.merge_strategy = protocol.SelvaMergeStrategy.MERGE_STRATEGY_NONE
    struct.res_type = protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_IDS

    const find = await client.command('hierarchy.find', [
      makeLangArg(ctx),
      createRecord(protocol.hierarchy_find_def, struct),
      sourceId(cmd),
      ...rpn,
    ])

    const ids = find[0]
    const { nestedFind } = cmd
    nestedFind.source = { idList: ids }
    return getCmd(ctx, nestedFind)
  } else {
    const { fields, isRpn: fieldsRpn, isInherit } = getFields(ctx, cmd.fields)
    struct.merge_strategy = protocol.SelvaMergeStrategy.MERGE_STRATEGY_NONE
    struct.res_opt_str = fields
    struct.res_type = isInherit
      ? protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_INHERIT_RPN
      : fieldsRpn
      ? protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS_RPN
      : protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS

    const find = await client.command('hierarchy.find', [
      makeLangArg(ctx),
      createRecord(protocol.hierarchy_find_def, struct),
      sourceId(cmd),
      ...rpn,
    ])

    return find
  }
}

export async function get(client: BasedDbClient, opts: any): Promise<any> {
  const ctx: ExecContext = {
    client,
  }

  let { $id, $language, $alias } = opts
  if ($alias) {
    const aliases = Array.isArray($alias) ? $alias : [$alias]
    const resolved = await ctx.client.command('resolve.nodeid', [
      '',
      ...aliases,
    ])

    $id = resolved?.[0]

    if (!$id) {
      return {}
    }
  }

  if ($language) {
    ctx.lang = $language
  }

  const { cmds, defaults } = await parseGetOpts(ctx, { ...opts, $id })
  console.dir({ cmds, defaults }, { depth: 8 })

  let q = cmds
  const nestedIds: any[] = []
  const nestedObjs: any[] = []
  let i = 0
  while (q.length) {
    const newCtx = { ...ctx }
    const results = await Promise.all(
      q.map((cmd) => {
        return getCmd(newCtx, cmd)
      })
    )

    const ids =
      results?.map(([cmdResult]) => {
        if (!Array.isArray(cmdResult)) {
          return []
        }

        // unwrap array structure
        return cmdResult.map((row) => {
          // take id
          return row?.[0]
        })
      }) ?? []
    nestedIds.push(ids)

    const obj = parseGetResult({ ...ctx }, q, results)
    nestedObjs.push(obj)

    q = q.reduce((all, cmd, j) => {
      const ids = nestedIds?.[i]?.[j]

      cmd.nestedCommands?.forEach((c) => {
        const ns = ids.map((id, k) => {
          const n: GetCommand = deepCopy(c)
          const path = c.target.path

          n.source = { id: id }
          const newPath = [...cmd.target.path]
          newPath.push(k, path[path.length - 1])
          n.target.path = newPath
          return n
        })

        all.push(...ns)
      })

      return all
    }, [])

    i++
  }

  const merged =
    nestedObjs.length === 1 && cmds[0].type === 'traverse' && !cmds[0].isSingle
      ? Array.from(nestedObjs[0]) // if it's a top-level $list expression, just parse it into array
      : deepMergeArrays({}, ...nestedObjs) // else merge all the results

  for (const d of defaults) {
    applyDefault(merged, d)
  }

  return merged
}

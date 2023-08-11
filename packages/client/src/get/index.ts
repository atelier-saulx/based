import { ExecContext, Field, Fields, GetCommand, Path } from './types'
import { protocol } from '..'
import { createRecord } from 'data-record'
import {
  ast2rpn,
  createAst,
  bfsExpr2rpn,
  fieldsExpr2rpn,
} from '@based/db-query'
import {
  SelvaTraversal,
  SelvaResultOrder,
  SelvaHierarchy_AggregateType,
} from '../protocol'
import { joinPath } from '../util'
import { setByPath } from '@saulx/utils'

export * from './types'
export * from './parse'

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

function getField(field: Field): { str: string; isInherit: boolean } {
  let str = joinPath(field.field)

  if (field.inherit) {
    str = '^:' + str
  }

  if (field.aliased) {
    str = str + '@' + field.aliased.join('|')
  }

  if (field.exclude) {
    str = '!' + str
  }

  return { str, isInherit: !!field.inherit }
}

function getFieldsStr(fields: Field[]): { fields: string; isInherit: boolean } {
  const hasWildcard = fields.some(({ field }) => {
    return field[0] === '*'
  })

  const strs: string[] = []
  if (hasWildcard) {
    for (const f of fields) {
      const [first, ...rest] = f.field
      if (rest.length) {
        const { str } = getField({
          type: 'field',
          field: [first],
          exclude: true,
        })
        strs.push(str)
      }
    }
  }

  let hasInherit = false
  for (const f of fields) {
    const { str, isInherit } = getField(f)

    strs.push(str)
    hasInherit = hasInherit || isInherit
  }

  return { fields: strs.join('\n'), isInherit: hasInherit }
}

function getFields(
  ctx: ExecContext,
  { $any, byType }: Fields
): {
  isRpn: boolean
  isInherit: boolean
  fields: string
} {
  if (byType) {
    let hasTypes = false
    const { fields: anyFields, isInherit } = getFieldsStr($any)
    const expr: Record<string, string> = { $any: anyFields }
    let hasInherit = isInherit
    for (const type in byType) {
      hasTypes = true
      const { fields, isInherit } = getFieldsStr([...$any, ...byType[type]])
      expr[type] = fields
      hasInherit = hasInherit || isInherit
    }

    if (!hasTypes && !hasInherit) {
      return { isRpn: false, fields: expr.$any, isInherit: false }
    }

    return {
      isRpn: true,
      isInherit: hasInherit,
      fields: fieldsExpr2rpn(ctx.client.schema.types, expr),
    }
  }

  const { fields, isInherit } = getFieldsStr($any)
  return {
    isRpn: false,
    fields: isInherit ? `"${fields}"` : fields,
    isInherit,
  }
}

function sourceId(cmd: GetCommand): string {
  return cmd.source.idList
    ? cmd.source.idList
        .map((id) => id.padEnd(protocol.SELVA_NODE_ID_LEN, '\0'))
        .join('')
    : cmd.source.id.padEnd(protocol.SELVA_NODE_ID_LEN, '\0')
}

function makeLangArg(ctx: ExecContext) {
  const { lang } = ctx

  if (!lang) {
    return ''
  }

  const languages = ctx?.client?.schema?.languages ?? []

  let str = lang
  for (let i = 0; i < languages.length; i++) {
    if (languages[i] === lang) {
      continue
    }

    str += `\n${languages[i]}`
  }

  return str
}

export async function get(ctx: ExecContext, commands: GetCommand[]) {
  return await Promise.all(
    commands.map(async (cmd) => {
      if (cmd.source.alias && !cmd.source.id) {
        cmd.source.id = await ctx.client.command(
          'resolve.nodeid',
          cmd.source.alias
        )
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
          const dir =
            mode || SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD

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
            SORT_ORDERS[cmd.sort.order] ??
            SelvaResultOrder.SELVA_RESULT_ORDER_NONE

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
        const nestedResult = await get(ctx, [nestedFind])
        return nestedResult[0]
      } else {
        const {
          fields,
          isRpn: fieldsRpn,
          isInherit,
        } = getFields(ctx, cmd.fields)
        struct.merge_strategy = protocol.SelvaMergeStrategy.MERGE_STRATEGY_NONE
        struct.res_opt_str = fields
        struct.res_type = isInherit
          ? protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_INHERIT_RPN
          : fieldsRpn
          ? protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS_RPN
          : protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS

        console.dir({ struct }, { depth: 8 })
        const find = await client.command('hierarchy.find', [
          makeLangArg(ctx),
          createRecord(protocol.hierarchy_find_def, struct),
          sourceId(cmd),
          ...rpn,
        ])

        return find
      }
    })
  )
}

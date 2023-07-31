import { ExecContext, Fields, GetCommand } from './types'
import { protocol } from '..'
import { createRecord } from 'data-record'
import {
  ast2rpn,
  createAst,
  TraverseByType,
  bfsExpr2rpn,
  fieldsExpr2rpn,
} from '@based/db-query'
import { SelvaTraversal } from '../protocol'

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

      const { fields, isRpn: fieldsRpn } = getFields(ctx, cmd.fields)

      const struct: any = {
        dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE,
        res_type: fieldsRpn
          ? protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS_RPN
          : protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
        merge_strategy: protocol.SelvaMergeStrategy.MERGE_STRATEGY_NONE,
        res_opt_str: fields,
        limit: BigInt(-1),
        offset: BigInt(0),
      }

      let rpn = ['#1']

      if (cmd.type === 'traverse') {
        if (cmd.sourceField) {
          const mode = TRAVERSE_MODES[cmd.sourceField]
          const dir =
            mode || SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD

          struct.dir = cmd.recursive ? RECURSIVE_TRAVERSE_MODES[dir] : dir

          if (!mode) {
            // if edge field, supply field name
            struct.dir_opt_str = cmd.sourceField
          }
        } else {
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
      }

      const find = await client.command('hierarchy.find', [
        ctx.lang || '',
        createRecord(protocol.hierarchy_find_def, struct),
        sourceId(cmd),
        ...rpn,
      ])

      return find
    })
  )
}

function getFields(
  ctx: ExecContext,
  { $any, byType }: Fields
): {
  isRpn: boolean
  fields: string
} {
  if (byType) {
    let hasTypes = false
    const expr: Record<string, string> = { $any: $any.join('\n') }
    for (const type in byType) {
      hasTypes = true
      expr[type] = [...$any, ...byType[type]].join('\n')
    }

    if (!hasTypes) {
      return { isRpn: false, fields: $any.join('\n') }
    }

    return {
      isRpn: true,
      fields: fieldsExpr2rpn(ctx.client.schema.types, expr),
    }
  }

  return { isRpn: false, fields: $any.join('\n') }
}

function sourceId(cmd: GetCommand): string {
  return cmd.source.idList
    ? cmd.source.idList
        .map((id) => id.padEnd(protocol.SELVA_NODE_ID_LEN, '\0'))
        .join('')
    : cmd.source.id.padEnd(protocol.SELVA_NODE_ID_LEN, '\0')
}

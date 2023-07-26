import {
  ExecContext,
  Fields,
  GetCommand,
  GetNode,
  GetTraverseExpr,
  GetTraverseField,
} from './types'
import { protocol } from '..'
import { createRecord } from 'data-record'
import {
  ast2rpn,
  createAst,
  TraverseByType,
  bfsExpr2rpn,
} from '@based/db-query'
import { SelvaTraversal } from '../protocol'

export * from './types'

// TODO: here recognize all the commands that can be run in one find and do it
export async function get(ctx: ExecContext, commands: GetCommand[]) {
  return await Promise.all(
    commands.map(async (cmd) => {
      if (cmd.source.alias && !cmd.source.id) {
        cmd.source.id = await ctx.client.command(
          'resolve.nodeid',
          cmd.source.alias
        )
      }

      switch (cmd.type) {
        case 'node':
          return execSingle(ctx, cmd)
        case 'traverse_field':
          return execTraverseField(ctx, cmd)
        case 'traverse_expr':
          return execTraverseExpr(ctx, cmd)
        default:
          return []
      }
    })
  )
}

function getFields(
  ctx: ExecContext,
  opts: Fields
): {
  isRpn: boolean
  fields: string
} {
  if (Object.keys(opts).length > 1) {
    const $any = new Set()
    for (const f of opts.$any) {
      if (f === '$all') {
        $any.add('*')
      } else {
        $any.add(f)
      }
    }

    const expr: TraverseByType = { $any: { $all: [] } }
    for (const type in opts) {
      const e = []

      for (const f of opts[type]) {
        if (f === '$all') {
          e.push('*')
        } else if (Array.isArray(f)) {
          e.push({ $first: f })
        } else {
          e.push(f)
        }
      }

      expr[type] = { $all: type === '$any' ? e : [...$any, ...e] }
    }

    return {
      isRpn: true,
      fields: bfsExpr2rpn(ctx.client.schema.types, expr),
    }
  }

  let str = ''
  for (const f of opts.$any) {
    if (f === '$all') {
      str += '*\n'
    } else if (Array.isArray(f)) {
      str += f.join('|') + '\n'
    } else {
      str += f + '\n'
    }
  }

  return { isRpn: false, fields: str }
}

function sourceId(cmd: GetCommand): string {
  return cmd.source.idList
    ? cmd.source.idList
        .map((id) => id.padEnd(protocol.SELVA_NODE_ID_LEN, '\0'))
        .join('')
    : cmd.source.id.padEnd(protocol.SELVA_NODE_ID_LEN, '\0')
}

async function execSingle(ctx: ExecContext, cmd: GetNode): Promise<void> {
  const { client } = ctx

  // TODO: handle different types
  const { fields, isRpn } = getFields(ctx, cmd.fields)

  const find = await client.command('hierarchy.find', [
    ctx.lang || '',
    createRecord(protocol.hierarchy_find_def, {
      dir: protocol.SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      merge_strategy: protocol.SelvaMergeStrategy.MERGE_STRATEGY_NONE,
      limit: BigInt(-1),
      offset: BigInt(0),
      res_opt_str: fields,
    }),
    sourceId(cmd),
    '#1',
  ])

  return find
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
}

async function execTraverseField(
  ctx: ExecContext,
  cmd: GetTraverseField
): Promise<void> {
  const { client } = ctx

  // TODO: handle different types
  const { fields, isRpn } = getFields(ctx, cmd.fields)

  const dir =
    TRAVERSE_MODES[cmd.sourceField] ||
    SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD

  let rpn = ['#1']
  if (cmd.filter) {
    const ast = createAst(cmd.filter)
    if (ast) {
      rpn = ast2rpn(ctx.client.schema.types, ast, ctx.lang || '')
    }
  }

  const find = await client.command('hierarchy.find', [
    ctx.lang || '',
    createRecord(protocol.hierarchy_find_def, {
      dir: cmd.recursive ? RECURSIVE_TRAVERSE_MODES[dir] : dir,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      merge_strategy: protocol.SelvaMergeStrategy.MERGE_STRATEGY_NONE,
      limit: BigInt(-1),
      offset: BigInt(0),
      res_opt_str: fields,
    }),
    sourceId(cmd),
    ...rpn,
  ])

  return find
}

// TODO
async function execTraverseExpr(
  ctx: ExecContext,
  cmd: GetTraverseExpr
): Promise<void> {
  return
}

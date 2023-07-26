import { ExecContext, Fields, GetCommand, GetNode, GetTraverse } from './types'
import { protocol } from '..'
import { createRecord } from 'data-record'
import { bfsExpr2rpn, TraverseByType } from '@based/db-query'

export * from './types'

// TODO: here recognize all the commands that can be run in one find and do it
export async function get(ctx: ExecContext, commands: GetCommand[]) {
  return await Promise.all(
    commands.map(async (cmd) => {
      switch (cmd.type) {
        case 'node':
          return execSingle(ctx, cmd)
        case 'traverse_field':
        case 'traverse_expr':
          return execTraverse(ctx, cmd)
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

async function execSingle(ctx: ExecContext, cmd: GetNode): Promise<void> {
  const { client } = ctx

  // TODO: handle different types
  const fields = cmd.fields.$any
    .map((f) => {
      if (Array.isArray(f)) {
        return f.join('|')
      }

      return f
    })
    .join('\n')

  const find = await client.command('hierarchy.find', [
    '',
    createRecord(protocol.hierarchy_find_def, {
      dir: protocol.SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      merge_strategy: protocol.SelvaMergeStrategy.MERGE_STRATEGY_NONE,
      limit: BigInt(-1),
      offset: BigInt(0),
      res_opt_str: fields,
    }),
    'root'.padEnd(protocol.SELVA_NODE_ID_LEN, '\0'),
    '#1',
  ])

  return find
}

async function execTraverse(ctx: ExecContext, cmd: GetTraverse): Promise<void> {
  const { client } = ctx

  // TODO: handle different types
  const fields = cmd.fields.$any
    .map((f) => {
      if (Array.isArray(f)) {
        return f.join('|')
      }

      return f
    })
    .join('\n')

  const find = await client.command('hierarchy.find', [
    '',
    createRecord(protocol.hierarchy_find_def, {
      // TODO: pluggable direction
      dir: protocol.SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      merge_strategy: protocol.SelvaMergeStrategy.MERGE_STRATEGY_NONE,
      limit: BigInt(-1),
      offset: BigInt(0),
      res_opt_str: fields,
    }),
    // TODO: handle if no id case
    cmd.source.id.padEnd(protocol.SELVA_NODE_ID_LEN, '\0'),
    // TODO: gen filter expr
    '#1',
  ])

  return find
}

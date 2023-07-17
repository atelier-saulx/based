import { ExecContext, GetCommand, GetNode, GetTraverse } from './types'
import { protocol } from '..'
import { createRecord } from 'data-record'

export * from './types'

// TODO: here recognize all the commands that can be run in one find and do it
export async function get(ctx: ExecContext, commands: GetCommand[]) {
  const nested: GetCommand[] = (
    await Promise.all(
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
  ).flat()

  await get(ctx, nested)
}

async function execSingle(ctx: ExecContext, cmd: GetNode): Promise<void> {
  const { client } = ctx

  const find = await client.command('hierarchy.find', [
    '',
    createRecord(protocol.hierarchy_find_def, {
      dir: protocol.SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS,
      res_type: protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
      merge_strategy: protocol.SelvaMergeStrategy.MERGE_STRATEGY_NONE,
      limit: BigInt(-1),
      offset: BigInt(0),
      res_opt_str: '*\naliases\nparents\nchildren',
    }),
    'root'.padEnd(protocol.SELVA_NODE_ID_LEN, '\0'),
    '#1',
  ])
  console.log('FIND', find)

  // TODO
}

async function execTraverse(ctx: ExecContext, cmd: GetTraverse): Promise<void> {
  // TODO
}

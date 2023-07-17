import { ExecContext, GetCommand, GetNode, GetTraverse } from './types'

export * from './types'

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
  // TODO
}

async function execTraverse(ctx: ExecContext, cmd: GetTraverse): Promise<void> {
  // TODO
}

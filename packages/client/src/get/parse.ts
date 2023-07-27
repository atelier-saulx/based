import { walk } from '@based/schema'
import { ExecContext, GetCommand, GetNode } from './types'

export async function parseGetOpts(
  ctx: ExecContext,
  opts: any
): Promise<GetCommand[]> {
  const cmds: GetCommand[] = []
  await walk<{ $id: string }>(
    {
      async init(val, args) {
        // TODO: deal with alias etc.
        return { $id: val.$id }
      },
      collect(args) {
        console.log('PUT', args.path, args.value)
        if (args.value === true) {
          return args.key
        }
      },
      schema: ctx.client.schema,
      parsers: {
        fields: {},
        keys: {
          $id: async (args) => {
            if (args.path.length >= 2) {
              // ignore top-level
              args.collect(args)
            }
          },
          $list: async (args) => {
            return
          },
        },
        async any(args) {
          args.collect(args)
          return args
        },
      },
      backtrack(args, entries) {
        const { path } = args
        const { $id } = args.target

        const fields: string[] = []
        const nestedCommands: GetCommand[] = []
        for (const entry of entries) {
          if (typeof entry === 'string') {
            fields.push(entry)
          } else {
            nestedCommands.push(entry)
          }
        }

        const cmd: GetNode = {
          fields: { $any: fields },
          type: 'node',
          source: { id: $id },
          target: { path },
          nestedCommands,
        }
        console.log('BACKTRACK', cmd)

        return cmd
      },
      async requiresAsyncValidation(t) {
        return false
      },
    },
    opts
  )

  return cmds
}

import { walk } from '@based/schema'
import { ExecContext, GetCommand } from './types'

export async function parseGetOpts(
  ctx: ExecContext,
  opts: any
): Promise<GetCommand[]> {
  const cmds: GetCommand[] = []
  await walk(
    {
      async init(val, args) {
        // TODO: deal with alias etc.
        return { $id: val.$id }
      },
      collect(args) {
        console.log('PUT', args.path, args.value)
        if (args.value === true) {
          return args.path[args.path.length - 1]
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
            const { value } = args
            if (value === true) {
              args.collect(args)
              return
            }

            return args
          },
        },
        async any(args) {
          args.collect(args)
          return args
        },
      },
      backtrack(args, cmds) {
        console.log('BACKTRACK', cmds)
        return cmds
      },
      async requiresAsyncValidation(t) {
        return false
      },
    },
    opts
  )

  return cmds
}

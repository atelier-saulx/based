import { walk } from '@based/schema'
import { ExecContext, GetCommand } from '../types'

export async function parseGetOpts(
  ctx: ExecContext,
  opts: any
): Promise<GetCommand[]> {
  let topLevel: GetCommand
  await walk<{
    id: string
    $id: string
    type: 'node' | 'traverse'
    $list?: any
  }>(
    {
      async init(args) {
        return {
          ...args,
          target: { id: args.value.$id, $id: args.value.$id, type: 'node' },
        }
      },
      collect(args) {
        if (args.value === true) {
          return args.key
        }
      },
      schema: ctx.client.schema,
      parsers: {
        fields: {},
        keys: {},
        async any(args) {
          const { key, value, target } = args

          if (typeof value === 'object') {
            if (value.$list) {
              return {
                ...args,
                target: {
                  ...args.target,
                  type: 'traverse',
                  $list: value.$list,
                },
              }
            } else if (value.$id) {
              return {
                ...args,
                target: {
                  ...args.target,
                  id: value.$id,
                },
              }
            }

            return {
              ...args,
              target: {
                ...args.target,
                type: 'node',
              },
            }
          }

          if (String(key).startsWith('$')) {
            return
          }

          args.collect(args)
          return args
        },
      },
      backtrack(args, backtracked, collected) {
        const entries = [...backtracked, ...collected]

        const { path, key } = args
        const { id, $id, type, $list } = args.target

        const shouldPrefixFields: boolean =
          type === 'node' && !!key && id === $id

        const fields: string[] = []
        const nestedCommands: GetCommand[] = []
        for (const entry of entries) {
          if (typeof entry === 'string') {
            fields.push(shouldPrefixFields ? `${key}.${entry}` : entry)
          } else {
            const nestedCmd: GetCommand = entry

            const canMerge: boolean =
              nestedCmd.type === 'node' && (nestedCmd.source?.id ?? $id) === $id

            if (canMerge) {
              // TODO: handle $field and false (exclude)
              for (const f of nestedCmd.fields.$any) {
                fields.push(shouldPrefixFields ? `${key}.${f}` : f)
              }
            } else {
              nestedCommands.push(nestedCmd)
            }
          }
        }

        let cmd: GetCommand
        if (type === 'node') {
          cmd = {
            type: 'node',
            fields: { $any: fields },
            source: { id: id },
            target: { path },
            nestedCommands,
          }
        } else {
          const sourceField = $list?.$find?.$traverse || String(key)
          cmd = {
            type: 'traverse',
            fields: { $any: fields },
            source: { id: id },
            target: { path },
            sourceField,
            nestedCommands,
          }
        }

        if (!path.length) {
          topLevel = cmd
        }

        return cmd
      },
      async requiresAsyncValidation(t) {
        return false
      },
    },
    opts
  )

  const nested = topLevel.nestedCommands
  delete topLevel.nestedCommands
  return [topLevel, ...nested]
}

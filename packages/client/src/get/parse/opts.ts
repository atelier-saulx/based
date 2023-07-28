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
        const $id = args.value.$id || 'root'
        return {
          ...args,
          target: { $id, id: $id, type: 'node' },
        }
      },
      collect(args) {
        const { key, value } = args

        if (value === true) {
          return args.key === '$all' ? '*' : args.key
        } else if (value === false) {
          return `!${args.key}`
        } else if (value?.$field) {
          let $field = value.$field
          if (Array.isArray(value.$field)) {
            $field = $field.join('|')
          }

          return `${key}@${$field}`
        }

        console.error('UNABLE TO PARSE', JSON.stringify(args.value))
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
            } else if (key === '$list') {
              return
            } else if (value.$id) {
              return {
                ...args,
                target: {
                  ...args.target,
                  id: value.$id,
                },
              }
            } else if (value.$field) {
              args.collect(args)
              return
            }

            return {
              ...args,
              target: {
                ...args.target,
                type: 'node',
              },
            }
          } else if (key === '$all') {
            args.collect(args)
            return args
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

          if ($list?.$find?.$filter) {
            cmd.filter = $list?.$find?.$filter
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

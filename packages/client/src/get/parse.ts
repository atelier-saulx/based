import { walk } from '@based/schema'
import { joinPath } from '../util'
import { ExecContext, GetCommand, GetNode, GetTraverse } from './types'

export async function parseGetOpts(
  ctx: ExecContext,
  opts: any
): Promise<GetCommand[]> {
  let topLevel: GetCommand
  await walk<{ $id: string; type: 'node' | 'traverse' }>(
    {
      async init(args) {
        return { ...args, target: { $id: args.value.$id, type: 'node' } }
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
        const { $id, type } = args.target

        const fields: string[] = []
        const nestedCommands: GetCommand[] = []
        for (const entry of entries) {
          if (typeof entry === 'string') {
            fields.push(type === 'node' && key ? `${key}.${entry}` : entry)
          } else {
            const nestedCmd: GetCommand = entry
            if (nestedCmd.type === 'node') {
              // TODO: handle if $id is different
              // TODO: handle $field and false (exclude)
              for (const f of nestedCmd.fields.$any) {
                fields.push(type === 'node' && key ? `${key}.${f}` : f)
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
            source: { id: $id },
            target: { path },
            nestedCommands,
          }
        } else {
          cmd = {
            type: 'traverse',
            fields: { $any: fields },
            source: { id: $id },
            target: { path },
            sourceField: String(key), // TODO: handle othoer cases like $find
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

export function parseGetResult(
  ctx: ExecContext,
  cmds: GetCommand[],
  results: any[]
): any {
  let obj = {}
  for (let i = 0; i < results.length; i++) {
    const result = results[i][0]
    const {
      target: { path },
    } = cmds[i]

    const k = joinPath(path)
    const parsed = parseResultRows(ctx, result)
    if (k === '') {
      obj = { ...obj, ...parsed[0] }
    } else {
      obj[k] = parsed
    }
  }

  return obj
}

function parseResultRows(ctx: ExecContext, result: [string, any[]][]) {
  return result.map((row) => {
    const [id, fields]: [string, any[]] = row

    const typeName = ctx.client.schema.prefixToTypeMapping[id.slice(0, 2)]
    const typeSchema = ctx.client.schema.types[typeName]

    const obj: any = {}
    for (let i = 0; i < fields.length; i += 2) {
      const f = fields[i]
      const v = fields[i + 1]

      // TODO: parse using schema, maybe use walker?
      obj[f] = v
    }

    return obj
  })
}

import { walk } from '@based/schema'
import { joinPath } from '../../util'
import { ExecContext, Field, GetCommand, GetNode, Path } from '../types'

export async function parseGetOpts(
  ctx: ExecContext,
  opts: any
): Promise<GetCommand[]> {
  let topLevel: GetCommand[] = []
  let visited: GetCommand
  await walk<{
    id: string
    $id: string
    nestedPath?: Path
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
        const {
          key,
          value,
          path,
          target: { $id, id, nestedPath },
        } = args

        if (nestedPath && $id === id) {
          // nested query with same $id should become a nested operation
          const nestedCmd: GetNode = {
            type: 'node',
            noMerge: true,
            fields: {
              $any: [{ type: 'field', field: path.slice(nestedPath.length) }],
            },
            source: {
              id,
            },
            target: {
              path: nestedPath,
            },
          }

          return nestedCmd
        }

        if (value === true) {
          return {
            type: 'field',
            field: args.key === '$all' ? ['*'] : [args.key],
          }
        } else if (value === false) {
          return { type: 'field', exclude: true, field: [`${args.key}`] }
        } else if (value?.$field) {
          let $field = value.$field
          if (!Array.isArray(value.$field)) {
            $field = [$field]
          }

          return { type: 'field', field: [key], aliased: $field }
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
            } else if (value.$find) {
              return {
                ...args,
                target: {
                  ...args.target,
                  type: 'traverse',
                  $list: {
                    $find: value.$find,
                    limit: 1,
                    offset: 0,
                    isSingle: true,
                  },
                },
              }
            } else if (key === '$find') {
              return
            } else if (value.$id) {
              return {
                ...args,
                target: {
                  ...args.target,
                  $id: args.target.id,
                  id: value.$id,
                  nestedPath: args.path,
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
          } else if (key === '$fieldsByType') {
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
          type === 'node' && key !== undefined && id === $id

        const fields: Field[] = []
        const byType: Record<string, Field[]> = {}
        const nestedCommands: GetCommand[] = []
        for (const entry of entries) {
          console.dir({ entry }, { depth: 8 })
          if (entry?.type === 'field') {
            fields.push({
              ...entry,
              field: shouldPrefixFields ? [key, ...entry.field] : entry.field,
            })
          } else {
            const nestedCmd: GetCommand = entry

            const canMerge: boolean =
              nestedCmd.type === 'node' &&
              (nestedCmd.source?.id ?? id) === id &&
              !nestedCmd.noMerge

            if (canMerge) {
              for (const fieldObj of nestedCmd.fields.$any) {
                const { field: f } = fieldObj
                if (String(f[0]).startsWith('$fieldsByType')) {
                  const [_$fieldsByType, type, ...field] = f
                  if (type === '$any') {
                    fields.push({ ...fieldObj, field })
                  } else {
                    byType[type] = byType[type] ?? []
                    byType[type].push({ ...fieldObj, field })
                  }
                } else {
                  fields.push({
                    ...fieldObj,
                    field: shouldPrefixFields ? [key, ...f] : f,
                  })
                }
              }

              for (const t in nestedCmd.fields?.byType) {
                byType[t] = byType[t] ?? []
                for (const fieldObj of nestedCmd.fields.byType[t]) {
                  const { field: f } = fieldObj
                  byType[t].push({
                    ...fieldObj,
                    field: shouldPrefixFields ? [key, ...f] : f,
                  })
                }
              }

              nestedCmd?.nestedCommands.forEach((c) => nestedCommands.push(c))
            } else if (nestedCmd.type === 'node') {
              // completely separate id queried
              topLevel.push(nestedCmd)
            } else {
              // actual nested query dependent on this result
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
          cmd = {
            type: 'traverse',
            fields: { $any: fields },
            source: { id: id },
            target: { path },
            nestedCommands,
          }

          const sourceField = $list?.$find?.$traverse || String(key)
          if (Array.isArray(sourceField)) {
            // find in id list
            cmd.source = { idList: sourceField }
          } else if (typeof sourceField === 'object') {
            cmd.traverseExpr = sourceField
          } else {
            cmd.sourceField = sourceField
          }

          if ($list?.$limit !== undefined || $list?.$offset !== undefined) {
            cmd.paging = {
              limit: $list?.$limit ?? -1,
              offset: $list?.$offset ?? 0,
            }
          }

          if ($list?.$sort !== undefined) {
            const { $order, $field } = $list.$sort
            cmd.sort = {
              order: $order,
              field: $field,
            }
          }

          if ($list?.isSingle !== undefined) {
            cmd.isSingle = $list.isSingle
          }

          if ($list?.$find?.$filter) {
            cmd.filter = $list?.$find?.$filter
          }

          if ($list?.$find?.$recursive) {
            cmd.recursive = true
          }
        }

        if (Object.keys(byType).length) {
          cmd.fields.byType = byType
        }

        // use to detect the very top level
        visited = cmd

        return cmd
      },
      async requiresAsyncValidation(t) {
        return false
      },
    },
    opts
  )

  const nested = visited.nestedCommands
  delete visited.nestedCommands
  return [visited, ...nested, ...topLevel]
}

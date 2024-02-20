import { walk } from '@based/schema'
import {
  ExecContext,
  Field,
  GetAggregate,
  GetCommand,
  GetNode,
  Path,
} from '../../types.js'
import { hashCmd } from '../../util.js'
import { parseList } from './list.js'
import { parseAlias } from './alias.js'
import { deepCopy, deepEqual } from '@saulx/utils'
import { joinPath } from '../../../util/index.js'

export async function parseGetOpts(
  ctx: ExecContext,
  opts: any
): Promise<{ cmds: GetCommand[]; defaults: { path: Path; value: any }[] }> {
  const hoisted: GetCommand[] = []
  let visited: GetCommand
  const walked = await walk<{
    id: string
    $id: string
    nestedPath?: Path
    type: 'node' | 'traverse' | 'aggregate'
    $list?: any
    defaultValues: { path: Path; value: any }[]
    $field?: { aliasPath: Path; currentPath: Path }
  }>(
    ctx.client.schema,
    {
      async init(value) {
        const $id = value.$id || 'root'

        return {
          target: { $id, id: $id, type: 'node', defaultValues: [] },
          parseTopLevel: true,
        }
      },
      collect(args) {
        const {
          key,
          value,
          path,
          target: { $id, id, nestedPath, $field, $list },
        } = args
        if (value?.$aggregate) {
          const { $aggregate } = value

          const cmd: GetAggregate = {
            type: 'aggregate',
            fields: { $any: [] },
            source: { id: id },
            target: { path },
            function:
              typeof $aggregate.$function === 'string'
                ? { $name: $aggregate.$function }
                : $aggregate.$function,
          }

          const { $sort, $limit, $offset } = $aggregate
          const $list = { $find: $aggregate, $sort, $limit, $offset }
          const parsed = parseList('aggregate', cmd, key, $list)
          parsed.cmdId = hashCmd(parsed)
          return parsed
        }

        // special cases
        if (!$list && nestedPath && $id === id) {
          const newPath = path.slice(nestedPath.length)
          // nested query with same $id should become a nested operation
          const nestedCmd: GetNode = {
            type: 'node',
            noMerge: true,
            fields: {
              $any: [
                {
                  type: 'field',
                  field: newPath[0] === '$all' ? ['*'] : newPath,
                  aliased: parseAlias(value),
                  exclude: value === false,
                },
              ],
            },
            source: {
              id,
            },
            target: {
              path: nestedPath,
            },
          }

          nestedCmd.cmdId = hashCmd(nestedCmd)
          return nestedCmd
        }

        if (
          value === true &&
          ['ancestors', 'descendants'].includes(String(args.key))
        ) {
          const nestedCmd: GetCommand = {
            type: 'ids',
            sourceField: <string>args.key,
            fields: { $any: [{ type: 'field', field: ['id'] }] },
            source: { id: id },
            target: { path },
            nestedCommands: [],
          }

          nestedCmd.cmdId = hashCmd(nestedCmd)
          return nestedCmd
        }

        // main logic
        const f = args.key === '$all' ? ['*'] : [args.key]

        let field: Field = {
          type: 'field',
          field: f,
          exclude: value === false,
          aliased: parseAlias(value),
        }

        if (value.$inherit) {
          let types = value.$inherit.$type ?? []
          types = (Array.isArray(types) ? types : [types])
            .map((type) => {
              if (type === 'root') {
                return 'ro'
              }

              return ctx.client?.schema?.types[type]?.prefix
            })
            .filter((prefix) => !!prefix)

          field.inherit = { types }
        }

        if ($field) {
          field.field = f
          field.aliased = [[...$field.aliasPath, ...f].join('.')]
        }

        return field
      },
      parsers: {
        fields: {},
        keys: {},
        async any(args) {
          const { key, value, path, target } = args

          if (typeof value === 'object') {
            if (Array.isArray(args?.prev?.value)) {
              target.nestedPath = args.path
            }

            if (value.$list) {
              if (value.$list === true) {
                value.$list = {}
              }

              if (value.$field) {
                if (!value.$list.$find) {
                  value.$list.$find = {}
                }

                value.$list.$field = value.$field
              }

              return {
                target: {
                  ...target,
                  type: 'traverse',
                  $list: deepCopy(value.$list),
                },
              }
            } else if (value.$aggregate) {
              args.collect()
              return
            } else if (key === '$list') {
              return
            } else if (value.$find) {
              return {
                target: {
                  ...target,
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
            } else if (value.$inherit) {
              args.collect()
              return
            } else if (key !== '' && value.$id) {
              return {
                target: {
                  ...target,
                  $id: target.id,
                  id: value.$id,
                  nestedPath: args.path,
                },
              }
            } else if (key !== '' && value.$alias) {
              const { $alias } = value
              const aliases = Array.isArray($alias) ? $alias : [$alias]
              const [resolved] = await this.command('resolve.nodeid', [
                0,
                ...aliases,
              ])
              const [, , id] = resolved

              return {
                target: {
                  ...target,
                  $id: target.id,
                  id,
                  nestedPath: args.path,
                },
              }
            } else if (value.$field) {
              if (Object.keys(value).length > 1) {
                return {
                  target: {
                    ...target,
                    type: 'node',
                    $field: {
                      aliasPath: value.$field.split('.'),
                      currentPath: path,
                    },
                  },
                }
              } else {
                args.collect()
                return
              }
            } else if (value.$default) {
              target.defaultValues.push({
                path: path,
                value: value.$default,
              })
              args.collect(true)
              return
            } else if (value.$value) {
              target.defaultValues.push({
                path: path,
                value: value.$value,
              })
              // apply default value but don't collect operation to execute
              return
            }

            return {
              target: {
                ...target,
                type: 'node',
              },
            }
          } else if (key === '$all') {
            args.collect()
            return {}
          } else if (key === '$fieldsByType') {
            return {}
          } else if (key === '$edgeMeta') {
            if (value === true) {
              args.collect()
            }

            return {}
          } else if (key == '$depth') {
            if (value === true) {
              args.collect()
            }

            return {}
          }

          if (String(key).startsWith('$')) {
            return
          }

          args.collect()
          return {}
        },
      },
      backtrack(args, backtracked, collected) {
        const entries = [...backtracked, ...collected]

        const { path, key } = args
        const { id, $id, type, $list } = args.target

        const shouldPrefixFields: boolean =
          type === 'node' && key !== '' && id === $id

        const fields: Field[] = []
        const byType: Record<string, Field[]> = {}
        const nestedCommands: GetCommand[] = []
        for (const entry of entries) {
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

            if (nestedCmd.type === 'node' && canMerge) {
              for (const fieldObj of nestedCmd.fields.$any) {
                const { field: f } = fieldObj
                if (String(f[0]).startsWith('$fieldsByType')) {
                  const [, type, ...field] = f
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
                    aliased: fieldObj.aliased?.length
                      ? fieldObj.aliased.map((alias: string) => {
                          return shouldPrefixFields && key !== '$fieldsByType'
                            ? key + '.' + alias
                            : alias
                        })
                      : undefined,
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
                    aliased: fieldObj.aliased?.length
                      ? fieldObj.aliased.map((alias: string) => {
                          return shouldPrefixFields && key !== '$fieldsByType'
                            ? key + '.' + alias
                            : alias
                        })
                      : undefined,
                  })
                }
              }

              nestedCmd?.nestedCommands.forEach((c) => {
                nestedCommands.push(c)
              })
            } else if (nestedCmd.type === 'node') {
              // completely separate id queried, merge if id already exists
              const existing = hoisted.find((cmd) => {
                return (
                  cmd.type === 'node' &&
                  cmd.source.id === nestedCmd.source.id &&
                  deepEqual(cmd.target.path, nestedCmd.target.path)
                )
              })

              if (existing) {
                existing.fields.$any.push(...nestedCmd.fields.$any)
                existing.cmdId = hashCmd(existing)
              } else {
                hoisted.push(nestedCmd)
              }
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
          cmd = parseList(
            'traverse',
            {
              type: 'traverse',
              fields: { $any: fields },
              source: { id: id },
              target: { path },
              nestedCommands: nestedCommands,
            },
            key,
            $list
          )
        }

        if (Object.keys(byType).length) {
          cmd.fields.byType = byType
        }

        // use to detect the very top level
        visited = cmd

        // calculate 'abstract markerId' - this will change when there is a concrete id
        cmd.cmdId = hashCmd(cmd)
        return cmd
      },
    },
    opts
  )

  const nested = visited.nestedCommands
  delete visited.nestedCommands

  const topLevel = [...hoisted, ...nested]
  topLevel.forEach((cmd) => {
    if (cmd.type === 'traverse' && cmd.sourceFieldByPath) {
      cmd.sourceField = joinPath(cmd.target.path)
    }
  })

  return {
    cmds: [visited, ...topLevel],
    defaults: walked.defaultValues,
  }
}

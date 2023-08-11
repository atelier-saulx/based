import { walk } from '@based/schema'
import {
  ExecContext,
  Field,
  GetAggregate,
  GetCommand,
  GetNode,
  GetTraverse,
  GetTraverseIds,
  Path,
} from '../types'

function parseAlias(value: any): string[] | undefined {
  let $field = value.$field
  if (!Array.isArray(value.$field)) {
    $field = [$field]
  }

  return $field
}

export async function parseGetOpts(
  ctx: ExecContext,
  opts: any
): Promise<{ cmds: GetCommand[]; defaults: { path: Path; value: any }[] }> {
  const topLevel: GetCommand[] = []
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
          return parseList('aggregate', cmd, key, $list)
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
                  field: newPath,
                  aliased: parseAlias(value),
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

          return nestedCmd
        }

        // main logic
        const f = args.key === '$all' ? ['*'] : [args.key]

        let field: Field = {
          type: 'field',
          field: f,
          exclude: value === false,
        }

        if (value?.$field) {
          field.aliased = parseAlias(value)
        }

        if (value.$inherit) {
          field.inherit = {}
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
                  $list: value.$list,
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
              const resolved = await this.command('resolve.nodeid', [
                '',
                ...aliases,
              ])
              const id = resolved?.[0]

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
            } else if (value.$inherit) {
              args.collect()
              return
            } else if (value.$default) {
              target.defaultValues.push({
                path: path,
                value: value.$default,
              })
              args.collect(true)
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

        return cmd
      },
    },
    opts
  )

  const nested = visited.nestedCommands
  delete visited.nestedCommands

  return {
    cmds: [visited, ...nested, ...topLevel],
    defaults: walked.defaultValues,
  }
}

function parseList(
  type: 'aggregate' | 'traverse',
  initial: GetTraverse | GetAggregate | GetTraverseIds,
  key: string | number,
  $list: any
): GetTraverse | GetTraverseIds | GetAggregate {
  const cmd: GetTraverse | GetAggregate | GetTraverseIds = { ...initial }

  if ($list?.$find?.$find) {
    cmd.type = 'ids'
    ;(<GetTraverseIds>cmd).mainType = type

    const { $sort, $limit, $offset } = $list
    const opts = { $sort, $limit, $offset }

    const nestedCmd: GetTraverse | GetAggregate | GetTraverseIds = parseList(
      type,
      {
        ...initial,
        type,
      },
      key,
      { $find: $list.$find.$find, ...opts }
    )

    for (const opt in opts) {
      delete $list[opt]
    }

    cmd.nestedFind = nestedCmd
  }

  const sourceField = $list?.$find?.$traverse ?? $list?.$field ?? String(key)
  if (Array.isArray($list?.$find?.$traverse)) {
    // find in id list
    cmd.source = { idList: sourceField }
  } else if (Array.isArray(sourceField)) {
    cmd.traverseExpr = { $any: { $first: sourceField } }
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
    // @ts-ignore
    cmd.isSingle = $list.isSingle
  }

  if ($list?.$find?.$filter) {
    cmd.filter = $list?.$find?.$filter
  }

  if ($list?.$find?.$recursive) {
    cmd.recursive = true
  }

  return cmd
}

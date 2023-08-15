import { ExecContext, GetCommand, Path } from './types'
import { BasedDbClient } from '..'
import { deepCopy, deepMergeArrays, setByPath } from '@saulx/utils'

export * from './types'
export * from './parse'

import { parseGetOpts, parseGetResult } from './parse'
import { getCmd } from './cmd'
import { hashCmd } from './util'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'

export function applyDefault(
  obj: any,
  { path, value }: { path: Path; value: any }
): void {
  for (let i = 0; i < path.length - 1; i++) {
    const part = path[i]
    if (!obj[part]) {
      const o = {}
      setByPath(o, path.slice(i + 1), value)
      obj[part] = o
      return
    }

    obj = obj[part]

    if (Array.isArray(obj)) {
      obj.forEach((x) => applyDefault(x, { path: path.slice(i + 1), value }))
      return
    }
  }

  const last = path[path.length - 1]
  if (obj[last] === undefined) {
    obj[last] = value
  }
}

export async function get(
  client: BasedDbClient,
  opts: any,
  isSubscription: boolean = false
): Promise<any> {
  const ctx: ExecContext = {
    client,
  }

  if (isSubscription) {
    ctx.subId = hashObjectIgnoreKeyOrder(opts)
  }

  let { $id, $language, $alias } = opts
  if ($alias) {
    const aliases = Array.isArray($alias) ? $alias : [$alias]
    const resolved = await ctx.client.command('resolve.nodeid', [
      '',
      ...aliases,
    ])

    $id = resolved?.[0]

    if (!$id) {
      return {}
    }
  }

  if ($language) {
    ctx.lang = $language
  }

  const { cmds, defaults } = await parseGetOpts(ctx, { ...opts, $id })

  let q = cmds
  const nestedIds: any[] = []
  const nestedObjs: any[] = []
  let i = 0
  while (q.length) {
    const newCtx = { ...ctx }
    const results = await Promise.all(
      q.map((cmd) => {
        return getCmd(newCtx, cmd)
      })
    )

    const ids =
      results?.map(([cmdResult]) => {
        if (!Array.isArray(cmdResult)) {
          return []
        }

        // unwrap array structure
        return cmdResult.map((row) => {
          // take id
          return row?.[0]
        })
      }) ?? []
    nestedIds.push(ids)

    const obj = parseGetResult({ ...ctx }, q, results)
    nestedObjs.push(obj)

    q = q.reduce((all, cmd, j) => {
      const ids = nestedIds?.[i]?.[j]

      cmd.nestedCommands?.forEach((c) => {
        const ns = ids.map((id, k) => {
          const n: GetCommand = deepCopy(c)
          const path = c.target.path

          n.source = { id: id }
          const newPath = [...cmd.target.path]
          newPath.push(k, path[path.length - 1])
          n.target.path = newPath
          n.markerId = hashCmd(n)
          return n
        })

        all.push(...ns)
      })

      return all
    }, [])

    i++
  }

  console.dir({ cmds, defaults }, { depth: 8 })
  if (ctx.markers) {
    await Promise.allSettled(ctx.markers)
  }

  const merged =
    nestedObjs.length === 1 && cmds[0].type === 'traverse' && !cmds[0].isSingle
      ? Array.from(nestedObjs[0]) // if it's a top-level $list expression, just parse it into array
      : deepMergeArrays({}, ...nestedObjs) // else merge all the results

  for (const d of defaults) {
    applyDefault(merged, d)
  }

  return merged
}

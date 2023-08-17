import { ExecContext, GetCommand } from '../types'
import { BasedDbClient } from '../..'
import { deepCopy, deepMergeArrays } from '@saulx/utils'

export * from '../types'
export * from '../parse'

import { parseGetOpts, parseGetResult } from '../parse'
import { getCmd } from './cmd'
import { hashCmd } from '../util'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { applyDefault } from '..'
import { createRecord } from 'data-record'
import { subscription_opts_def } from '../../protocol'

export async function get(
  client: BasedDbClient,
  opts: any,
  {
    isSubscription,
    subId,
    markerId,
  }: {
    isSubscription: boolean
    subId?: number
    markerId?: number
  } = {
    isSubscription: false,
  }
): Promise<any> {
  const ctx: ExecContext = {
    client,
  }

  if (isSubscription) {
    ctx.subId = subId || hashObjectIgnoreKeyOrder(opts)
    ctx.markerId = markerId
    ctx.markers = []
  }

  let { $id, $language, $alias } = opts
  if ($alias) {
    const aliases = Array.isArray($alias) ? $alias : [$alias]
    const resolved = await ctx.client.command('resolve.nodeid', [0, ...aliases])

    $id = resolved?.[0]

    if (!$id) {
      return {}
    }
  }

  if ($language) {
    ctx.lang = $language
  }

  const { cmds, defaults } = await parseGetOpts(ctx, { ...opts, $id })

  const nestedObjs = await execParallel(ctx, cmds)

  console.dir({ cmds, defaults }, { depth: 8 })
  if (ctx.markers?.length) {
    await Promise.all(
      ctx.markers.map((marker) => {
        return client.command('subscriptions.add', [
          ctx.subId,
          marker.cmdID,
          createRecord(subscription_opts_def, marker.struct),
          marker.nodeId,
          marker.strFields,
          ...marker.rpn,
        ])
      })
    )
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

async function execParallel(ctx: ExecContext, cmds: GetCommand[]) {
  const { markerId, subId } = ctx

  let q = cmds
  const nestedIds: any[] = []
  const nestedObjs: any[] = []
  let i = 0
  while (q.length) {
    const results = await Promise.all(
      q.map(async (cmd) => {
        if (subId && (cmd.markerId ?? cmd.cmdId) === markerId && !ctx.cleanup) {
          // clean up markers and cache
          await execParallel({ ...ctx, cleanup: true }, [cmd])
        }

        return getCmd(ctx, cmd)
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
        const ns = ids.map((id: string, k: number) => {
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

  return nestedObjs
}

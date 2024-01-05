import { ExecContext, GetCommand } from '../types.js'
import { BasedDbClient } from '../../index.js'
import { deepCopy, deepMergeArrays } from '@saulx/utils'

export * from '../types.js'
export * from '../parse/index.js'

import { parseGetOpts, parseGetResult } from '../parse/index.js'
import { getCmd, resolveNodeId } from './cmd.js'
import { hashCmd } from '../util.js'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { createRecord } from 'data-record'
import { subscription_opts_def } from '../../protocol/index.js'
import { Path } from '@based/schema'

export async function get(
  client: BasedDbClient,
  opts: any,
  {
    isSubscription,
    subId,
    markerId,
    cleanup,
  }: {
    isSubscription: boolean
    subId?: number
    markerId?: number
    cleanup?: boolean
  } = {
    isSubscription: false,
  }
): Promise<{
  merged: any
  defaults?: { path: Path; value: any }[]
  pending?: GetCommand
  subId?: number
  markerId?: number
  markers?: any[]
}> {
  if (markerId && cleanup && markerId === subId) {
    // initial lookup invalidated, do full cleanup
    await get(client, opts, {
      isSubscription: true,
      subId,
      markerId,
      cleanup: true,
    })

    client.purgeCache(subId)

    // then do the real get again without marker id
    return get(client, opts, {
      isSubscription: true,
      subId,
    })
  }

  const ctx: ExecContext = {
    client,
  }

  if (isSubscription) {
    ctx.subId = subId || hashObjectIgnoreKeyOrder(opts)

    ctx.markerId = client.mapSubMarkerId(markerId!) // TODO: handle undefined
    ctx.markers = []
    ctx.cleanup = cleanup
  }

  let { $id, $language, $alias } = opts
  if ($alias) {
    const aliases = Array.isArray($alias) ? $alias : [$alias]
    $id = await resolveNodeId(
      // pass both as sub-id and track this case with it
      { client, subId: ctx.subId, markerId: ctx.subId },
      {
        type: 'node',
        fields: { $any: [{ type: 'field', field: ['id'] }] },
        source: { alias: aliases[0] },
        target: { path: [] },
        cmdId: ctx.subId!, // TODO: handle undefined
      },
      aliases
    )

    if (!$id) {
      return { merged: {}, defaults: [] }
    }
  }

  if ($language) {
    ctx.lang = $language
  }

  const { cmds, defaults } = await parseGetOpts(ctx, { ...opts, $id })

  const { nestedObjs, pending } = await execParallel(ctx, cmds)

  const merged =
    nestedObjs.length === 1 && cmds[0].type === 'traverse' && !cmds[0].isSingle
      ? Array.from(nestedObjs[0]) // if it's a top-level $list expression, just parse it into array
      : deepMergeArrays({}, ...nestedObjs) // else merge all the results

  return {
    merged,
    defaults,
    pending,
    subId: ctx.subId,
    markerId: ctx.markerId,
    markers: ctx.markers,
  }
}

export async function addMarkers(
  ctx: ExecContext,
  markers: any[]
): Promise<void> {
  const { subId, client } = ctx
  await Promise.all(
    markers.map((marker) => {
      return client.command('subscriptions.addMarker', [
        subId,
        marker.cmdID,
        createRecord(subscription_opts_def, marker.struct),
        marker.nodeId,
        marker.strFields,
        ...marker.rpn,
      ])
    })
  )
}

export async function execParallel(
  ctx: ExecContext,
  cmds: GetCommand[]
): Promise<{ nestedObjs: any[]; pending?: GetCommand }> {
  const { markerId, subId, cleanup, refresh } = ctx

  let pending: GetCommand | undefined
  let q = cmds
  const nestedIds: any[] = []
  const nestedObjs: any[] = []
  let i = 0
  while (q.length) {
    const p = q.find((cmd) => {
      return subId && (cmd.markerId ?? cmd.cmdId) === markerId && !ctx.cleanup
    })

    if (p) {
      pending = p
    }

    const results = await Promise.all(
      q.map(async (cmd) => {
        if (
          !refresh &&
          subId &&
          !cleanup &&
          (cmd.markerId ?? cmd.cmdId) === markerId
        ) {
          // return a shallow result for changed subgraph unless cleaning or refreshing result
          return [[]]
        }

        let omit = false
        const r = await getCmd(ctx, cmd, (p) => {
          pending = p

          if (!refresh && subId && !cleanup) {
            omit = true
          }
        })

        return omit ? [[]] : r
      })
    )

    const ids =
      results?.map((cmdResult, _i) => {
        if (!cmdResult) {
          return []
        }

        cmdResult = cmdResult[0]
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

    q = q.reduce((all: GetCommand[], cmd, j) => {
      const ids = nestedIds?.[i]?.[j]

      cmd.nestedCommands?.forEach((c) => {
        const ns: GetCommand[] = ids.map((id: string, k: number) => {
          const n: GetCommand = deepCopy(c)
          const path = c.target.path

          n.source = { id: id }
          const newPath = [...cmd.target.path]
          if (cmd.type === 'node') {
            newPath.push(path[path.length - 1])
          } else {
            newPath.push(k, path[path.length - 1])
          }
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

  return { nestedObjs, pending }
}

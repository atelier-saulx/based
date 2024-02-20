import {
  ExecContext,
  GetCommand,
  addMarkers,
  applyDefault,
  execParallel,
  get,
} from '../get/index.js'
import { BasedDbClient } from '../index.js'
import { nextTimestamp } from '../get/exec/timebased.js'

export async function sub(
  client: BasedDbClient,
  opts: any,
  eventOpts?: { markerId: number; subId: number }
): Promise<{
  subId: number
  cleanup: () => Promise<void>
  fetch: () => Promise<void>
  getValue: () => Promise<any>
  pending?: GetCommand
  nextRefresh?: () => Promise<
    { nextRefresh: number; markerId: number; subId: number }[]
  >
}> {
  const origMarkerId = eventOpts?.markerId
  const { subId, markerId, pending, markers } = await get(client, opts, {
    isSubscription: true,
    ...eventOpts,
  })

  await addMarkers({ client, subId, markerId }, markers)
  const nowMarkers = markers.filter((m) => m.hasNow)

  const cleanup = async () => {
    if (origMarkerId !== markerId) {
      try {
        await client.command('subscriptions.delmarker', [subId, origMarkerId])
      } catch (e) {
        console.error('Error cleaning up marker', subId, origMarkerId)
      }
    }

    if (!eventOpts?.markerId || !pending?.nestedCommands?.length) {
      return
    }

    const ctx: ExecContext = {
      lang: opts.$language,
      client,
      subId,
      markerId,
      cleanup: true,
    }

    await execParallel(ctx, [pending])
  }

  // new results
  const fetch = async () => {
    if (pending) {
      const ctx: ExecContext = {
        lang: opts.$language,
        client,
        subId,
        markerId,
        markers: [],
        refresh: true,
      }

      await execParallel(ctx, [pending])
      await addMarkers(ctx, [...ctx.markers])

      nowMarkers.push(...ctx.markers.filter((m) => m.hasNow))
    }
  }

  const nextRefresh = async () => {
    if (!nowMarkers?.length) {
      return []
    }

    return nextTimestamp(client, opts.$language, subId, nowMarkers)
  }

  const getValue = async () => {
    const { merged, defaults } = await get(client, opts, {
      isSubscription: true,
      subId,
      markerId: -1,
    })

    for (const d of defaults) {
      applyDefault(merged, d)
    }

    return merged
  }

  return { pending, cleanup, fetch, subId, nextRefresh, getValue }
}

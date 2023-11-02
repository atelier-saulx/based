import { deepMergeArrays } from '@saulx/utils'
import {
  ExecContext,
  GetCommand,
  addMarkers,
  applyDefault,
  execParallel,
  get,
} from '../get'
import { BasedDbClient } from '..'

export async function sub(
  client: BasedDbClient,
  opts: any,
  eventOpts?: { markerId: number; subId: number }
): Promise<{
  subId: number
  cleanup: () => Promise<void>
  fetch: () => Promise<any>
  pending?: GetCommand
}> {
  const origMarkerId = eventOpts?.markerId
  const { subId, markerId, merged, defaults, pending, markers } = await get(
    client,
    opts,
    {
      isSubscription: true,
      ...eventOpts,
    }
  )

  await addMarkers({ client, subId, markerId }, markers)

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

      const { nestedObjs } = await execParallel(ctx, [pending])
      await addMarkers(ctx, [...ctx.markers])

      deepMergeArrays(merged, ...nestedObjs)
    }

    for (const d of defaults) {
      applyDefault(merged, d)
    }

    return merged
  }

  return { pending, cleanup, fetch, subId }
}

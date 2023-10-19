import {
  BasedSchema,
  BasedSchemaCollectProps,
  BasedSchemaPartial,
  setWalker,
} from '@based/schema'

import Emitter from './Emitter'
import { addCommandToQueue, drainQueue } from './outgoing'
import connect from './socket'
import { Connection } from './socket/types'
import {
  CommandQueue,
  CommandResponseListeners,
  IncomingMessageBuffers,
  SchemaUpdateMode,
  SubscriptionHandlers,
} from './types'
import { incoming } from './incoming'
import { Command } from './protocol/types'
import { set, toModifyArgs } from './set'
import {
  ExecContext,
  GetCommand,
  addMarkers,
  applyDefault,
  execParallel,
  get,
} from './get'
import genId from './id'
import { deepMergeArrays } from '@saulx/utils'
import { getCmd, mapSubMarkerId, purgeCache } from './get/exec/cmd'
import { DEFAULT_SCHEMA, updateSchema } from './schema'

export * as protocol from './protocol'
export * as dataRecord from 'data-record'
export * as schema from '@based/schema'

export * as get from './get'

export type BasedDbClientOpts = { port: number; host: string }

/* TODO: very important
Every once in a while check all the open commands
- if it's a set, probably just wanna fail it (reject) and then clean up
- if it's a get, maybe wanna retry it and not do anything, maybe have a counter or something and then reject also

Only do counting if there is an active connection
*/

export class BasedDbClient extends Emitter {
  public schema: BasedSchema = DEFAULT_SCHEMA

  public connected: boolean = false
  public connection: Connection
  public isDestroyed: boolean
  public opts: BasedDbClientOpts
  public drainTimeout: NodeJS.Timeout
  // --------- Queue
  public commandQueue: CommandQueue = []
  public drainInProgress: boolean = false
  // --------- Command State
  public commandResponseListeners: CommandResponseListeners = new Map()
  public subscriptionHandlers: SubscriptionHandlers = new Map()
  public seqId: number = 0
  // ---------------
  // TODO: periodic cleanup
  public incomingMessageBuffers: IncomingMessageBuffers = new Map()

  public updateSchemaTimer: NodeJS.Timeout

  public backpressureBlock: Buffer | null = null

  constructor() {
    super()
    console.info('make a new db client...')
  }

  // TODO: in the future this has to ensure schema
  async id({ type }: { type: string }): Promise<string> {
    return genId(this.schema, type)
  }

  subscribeSchema(): void {
    if (this.updateSchemaTimer) {
      return
    }

    if (!this.schema) {
      this.schema = DEFAULT_SCHEMA
    }

    this.updateSchemaTimer = setInterval(async () => {
      try {
        const { schema } = await this.get({ $id: 'root', schema: true })
        if (schema) {
          this.schema = schema
        }
      } catch (e) {
        console.error('Error in schema subscription', e)
      }
    }, 3e3)
  }

  unsubscribeSchema(): void {
    if (this.updateSchemaTimer) {
      clearInterval(this.updateSchemaTimer)
      this.updateSchemaTimer = undefined
    }
  }

  async updateSchema(
    schema: BasedSchemaPartial,
    options?: {
      merge?: boolean,
      mode?: SchemaUpdateMode
    }
  ): Promise<BasedSchema> {
    const newSchema = await updateSchema(this, schema, options?.merge, options?.mode)
    this.schema = newSchema
    return newSchema
  }

  // TODO: later take type from @based/schema
  async set(opts: any): Promise<string> {
    if (!this.schema) {
      // TODO: schema subscription and wait for schema
      throw new Error('No schema, bad')
    }

    return set(this, opts)
  }

  async delete({
    $id,
    $recursive = false,
    $returnIds = false,
  }: {
    $id: string
    $returnIds?: boolean
    $recursive?: boolean
  }): Promise<any> {
    if (!$id || typeof $id !== 'string') {
      throw new Error(`Invalid id ${$id}`)
    }

    const flags = `${($recursive && 'F') || ''}${($returnIds && 'I') || ''}`
    const resp = await this.command('hierarchy.del', [flags, $id])
    return resp?.[0]
  }

  async get(opts: any): Promise<any> {
    const { merged, defaults } = await get(this, opts)
    console.dir({ merged, defaults }, { depth: 6 })

    for (const d of defaults) {
      applyDefault(merged, d)
    }

    return merged
  }

  async refreshMarker(markerId: number): Promise<void> {
    const id = mapSubMarkerId(markerId)
    purgeCache(id)
    try {
      await this.command('subscriptions.refreshMarker', [id])
    } catch (e) {
      console.error('Marker refresh error', e)
    }
  }

  async sub(
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
      this,
      opts,
      {
        isSubscription: true,
        ...eventOpts,
      }
    )

    await addMarkers({ client: this, subId, markerId }, markers)

    const cleanup = async () => {
      if (origMarkerId !== markerId) {
        try {
          await this.command('subscriptions.delmarker', [subId, origMarkerId])
        } catch (e) {
          console.error('Error cleaning up marker', subId, origMarkerId)
        }
      }

      if (!eventOpts?.markerId || !pending?.nestedCommands?.length) {
        return
      }

      const ctx: ExecContext = {
        lang: opts.$language,
        client: this,
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
          client: this,
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

  onData(data: Buffer) {
    incoming(this, data)
  }

  onReconnect() {
    this.connected = true
    this.emit('reconnect', true)
  }

  onOpen() {
    this.connected = true
    this.emit('connect', true)
    drainQueue(this)
  }

  onClose() {
    if (this.connected) {
      this.connected = false
      this.emit('disconnect', true)
    }
  }

  public connect(opts: { port: number; host: string }) {
    if (
      this.opts &&
      (this.opts.port !== opts.port || this.opts.host !== opts.host)
    ) {
      this.disconnect()
    }
    this.opts = opts
    this.connection = connect(this, opts.port, opts.host)
  }

  disconnect() {
    if (this.connection) {
      this.connection.disconnected = true
      if (this.connection.socket) {
        this.connection.socket.removeAllListeners()
        this.connection.socket.destroy()
        this.connection.socket.unref()
      }
      if (this.connected) {
        this.onClose()
      }
      delete this.connection
    }
    this.connected = false
    this.backpressureBlock = null
  }

  destroy() {
    this.disconnect()
    for (const i in this) {
      delete this[i]
    }
    this.isDestroyed = true
  }

  command(command: Command, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      addCommandToQueue(this, payload, command, resolve, reject)
    })
  }
}

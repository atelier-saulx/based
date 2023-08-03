import { BasedSchema, BasedSchemaPartial, setWalker } from '@based/schema'

import Emitter from './Emitter'
import { addCommandToQueue, drainQueue } from './outgoing'
import connect from './socket'
import { Connection } from './socket/types'
import {
  CommandQueue,
  CommandResponseListeners,
  IncomingMessageBuffers,
} from './types'
import { incoming } from './incoming'
import { Command } from './protocol/types'
import { toModifyArgs } from './set'
import {
  applyDefault,
  ExecContext,
  get,
  GetCommand,
  parseGetOpts,
  parseGetResult,
} from './get'
import genId from './id'
import { deepCopy, deepMerge, deepMergeArrays, getByPath } from '@saulx/utils'

export * as protocol from './protocol'

export type BasedDbClientOpts = { port: number; host: string }

/* TODO: very important
Every once in a while check all the open commands
- if it's a set, probably just wanna fail it (reject) and then clean up
- if it's a get, maybe wanna retry it and not do anything, maybe have a counter or something and then reject also

Only do counting if there is an active connection
*/

export class BasedDbClient extends Emitter {
  public schema: BasedSchema

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
  public seqId: number = 0
  // ---------------
  // TODO: periodic cleanup
  public incomingMessageBuffers: IncomingMessageBuffers = new Map()

  public backpressureBlock: Buffer | null = null

  constructor() {
    super()
    console.info('make a new db client...')
  }

  // TODO: in the future this has to ensure schema
  async id({ type }: { type: string }): Promise<string> {
    return genId(this.schema, type)
  }

  async updateSchema(opts: BasedSchemaPartial): Promise<BasedSchema> {
    // TODO: make it for real
    this.schema = <BasedSchema>opts
    if (!this.schema.prefixToTypeMapping) {
      this.schema.prefixToTypeMapping = {}
    }

    const types: [string, string][] = []
    for (const typeName in this.schema.types) {
      const type = this.schema.types[typeName]
      this.schema.prefixToTypeMapping[type.prefix] = typeName
      types.push([type.prefix, typeName])

      this.schema.types[typeName].fields.id = { type: 'string' }
      this.schema.types[typeName].fields.type = { type: 'string' }
      this.schema.types[typeName].fields.parents = { type: 'references' }
      this.schema.types[typeName].fields.children = { type: 'references' }
      this.schema.types[typeName].fields.ancestors = { type: 'references' }
      this.schema.types[typeName].fields.descendants = { type: 'references' }
      this.schema.types[typeName].fields.aliases = {
        type: 'set',
        items: { type: 'string' },
      }
    }

    // root
    this.schema.prefixToTypeMapping['ro'] = 'root'
    types.push(['ro', 'root'])

    if (this.schema.root) {
      this.schema.root.fields.id = { type: 'string' }
      this.schema.root.fields.type = { type: 'string' }
      this.schema.root.fields.children = { type: 'references' }
      this.schema.root.fields.descendants = { type: 'references' }
      this.schema.root.fields.aliases = {
        type: 'set',
        items: { type: 'string' },
      }
    }

    // set type map in db
    await this.command('hierarchy.types.clear')
    await Promise.all(
      types.map((args) => {
        return this.command('hierarchy.types.add', args)
      })
    )

    return this.schema
  }

  // TODO: later take type from @based/schema
  async set(opts: any): Promise<string> {
    if (!this.schema) {
      // TODO: schema subscription and wait for schema
      throw new Error('No schema, bad')
    }

    const args: any[] = []
    const { $alias, $id, $language } = await setWalker(this.schema, opts, {
      // TODO: we will design how non-type generic filters work later
      checkRequiredFields: async (path) => {
        return true
      },
      referenceFilterCondition: async (id) => {
        return true
      },
      collect: (props) => {
        if (props?.fieldSchema?.type === 'text') {
          for (const lang in props.value) {
            args.push(
              ...toModifyArgs({
                target: props.target,
                typeSchema: props.typeSchema,
                fieldSchema: { type: 'string' },
                value: props.value[lang],
                path: [...props.path, lang],
              })
            )
          }

          args.push(...toModifyArgs(props))
        } else {
          args.push(...toModifyArgs(props))
        }
      },
    })

    let id = $id
    if (!id && $alias) {
      const args = Array.isArray($alias) ? $alias : [$alias]
      const resolved = await this.command('resolve.nodeid', ['', ...args])
      id = resolved?.[0]
    }

    if (!id) {
      id = genId(this.schema, opts.type)
    }

    if (!args.length) {
      return id
    }

    const resp = await this.command('modify', [id, args])
    const err = resp?.[0]?.find((x: any) => {
      return x instanceof Error
    })

    if (err) {
      throw err
    }

    return resp?.[0]?.[0]
  }

  async get(opts: any): Promise<any> {
    const ctx: ExecContext = {
      client: this,
    }

    if (opts.$language) {
      ctx.lang = opts.$language
    }

    let { cmds, defaults } = await parseGetOpts({ client: this }, opts)
    console.dir({ cmds, defaults }, { depth: 8 })

    const nestedIds: any[] = []
    const nestedObjs: any[] = []
    let i = 0
    while (cmds.length) {
      const results = await get(ctx, cmds)

      const ids = results.map((cmdResult) => {
        // unwrap array structure
        return (
          cmdResult?.[0].map((row) => {
            // take id
            return row?.[0]
          }) ?? []
        )
      })
      nestedIds.push(ids)

      const obj = parseGetResult(ctx, cmds, results)
      nestedObjs.push(obj)

      cmds = cmds.reduce((all, cmd, j) => {
        const ids = nestedIds?.[i]?.[j]

        cmd.nestedCommands?.forEach((c) => {
          const ns = ids.map((id, k) => {
            const n: GetCommand = deepCopy(c)
            const path = c.target.path

            n.source = { id: id }
            const newPath = [...cmd.target.path]
            newPath.push(k, path[path.length - 1])
            n.target.path = newPath
            return n
          })

          all.push(...ns)
        })

        return all
      }, [])

      i++
    }

    const merged = deepMergeArrays({}, ...nestedObjs)
    console.dir({ nestedObjs, merged, defaults }, { depth: 8 })
    for (const d of defaults) {
      applyDefault(merged, d)
    }

    console.dir({ complete: merged })
    return merged
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

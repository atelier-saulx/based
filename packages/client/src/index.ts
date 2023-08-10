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
import { deepCopy, deepMergeArrays } from '@saulx/utils'
import { ModifyArgType } from './protocol/encode/modify/types'

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

      type.fields.id = { type: 'string' }
      type.fields.createdAt = { type: 'timestamp' }
      type.fields.updatedAt = { type: 'timestamp' }
      type.fields.type = { type: 'string' }
      type.fields.parents = { type: 'references' }
      type.fields.children = { type: 'references' }
      type.fields.ancestors = { type: 'references' }
      type.fields.descendants = { type: 'references' }
      type.fields.aliases = {
        type: 'set',
        items: { type: 'string' },
      }

      await this.command('hierarchy.types.add', [type.prefix, typeName])
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

    let { $id, $alias } = opts
    if (!$id && $alias) {
      const args = Array.isArray($alias) ? $alias : [$alias]
      const resolved = await this.command('resolve.nodeid', ['', ...args])
      $id = resolved?.[0]
      if (!$id && !opts.aliases) {
        opts.aliases = { $add: args }
      }
    }

    if (!$id) {
      $id = genId(this.schema, opts.type)
    }

    let flags: string = ''
    // TODO: get this from target of setWalker
    if (opts.$noRoot) {
      flags += 'N'
      delete opts.$noRoot // TODO: setWalker does not support $noRoot
    }

    if (opts.$merge === false) {
      flags += 'M'
    }

    const { errors, collected } = await setWalker(
      this.schema,
      opts,
      async (args, type) => {
        if (type !== 'modifyObject') {
          throw new Error(`Unsupported nested operation: ${type}`)
        }

        const { path, value } = args

        const nestedOpts = { ...value, $noRoot: true }

        const refField = String(path[0])
        if (
          !['parents', 'children'].includes(refField) &&
          !nestedOpts.parents &&
          !nestedOpts.children
        ) {
          nestedOpts.parents = ['root']
        }

        if (opts.$language) {
          nestedOpts.$language = opts.$language
        }

        return this.set(nestedOpts)
      }
    )

    if (errors?.length) {
      // TODO
      throw new Error(JSON.stringify(errors))
    }

    const args: any[] = []
    collected.forEach((props: Required<BasedSchemaCollectProps>) => {
      let { path, value } = props

      if (path.length === 1 && path[0] === 'type') {
        return
      }

      if (props?.fieldSchema?.type === 'text') {
        if (value.$delete === true) {
          args.push(
            ...toModifyArgs({
              path: [...props.path],
              fieldSchema: { type: 'string' },
              value: value,
            })
          )

          return
        }

        if (value.$default) {
          value = value.$default
        }
        for (const lang in value) {
          args.push(
            ...toModifyArgs({
              path: [...props.path, lang],
              fieldSchema: { type: 'string' },
              value: value.$default ? { $default: value[lang] } : value[lang],
            })
          )
        }

        args.push(...toModifyArgs(props))
      } else {
        args.push(...toModifyArgs(props))
      }
    })

    if (!args.length) {
      return $id
    }

    const resp = await this.command('modify', [$id, flags, args])
    const err = resp?.[0]?.find((x: any) => {
      return x instanceof Error
    })

    if (err) {
      console.error(err)
    }

    return resp?.[0]?.[0]
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
    const ctx: ExecContext = {
      client: this,
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
    console.dir({ cmds, defaults }, { depth: 8 })

    let q = cmds
    const nestedIds: any[] = []
    const nestedObjs: any[] = []
    let i = 0
    while (q.length) {
      const results = await get({ ...ctx }, q)

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
            return n
          })

          all.push(...ns)
        })

        return all
      }, [])

      i++
    }

    const merged =
      nestedObjs.length === 1 &&
      cmds[0].type === 'traverse' &&
      !cmds[0].isSingle
        ? Array.from(nestedObjs[0]) // if it's a top-level $list expression, just parse it into array
        : deepMergeArrays({}, ...nestedObjs) // else merge all the results

    for (const d of defaults) {
      applyDefault(merged, d)
    }

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

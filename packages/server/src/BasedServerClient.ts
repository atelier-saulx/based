import {
  Query,
  SetOptions,
  GetOptions,
  GenericObject,
  Copy,
  Configuration,
  TrackOpts,
  generateTrackingKey,
} from '@based/client'
import RedisSelvaClient from '@saulx/selva/dist/src/redis'
import { copy } from './handlers/copy'
import { deleteEvent, trackEvent } from './handlers/track'
import {
  getSecret,
  decodeValueBySecret,
  encodeValueBySecret,
  decodeToken,
} from './secrets'
import { Params } from './Params'
import { getFunction, getAuthorize } from './getFromConfig'
import findPrefix from './findPrefix'
import { hashCompact } from '@saulx/hash'
import { subscribeFunction } from './handlers/functions/observable'
import { subscribeConfiguration } from './handlers/configuration'
import { SignOptions } from 'jsonwebtoken'

// ----------------
// import {
//   subscribeObservable,
//   getObservable,
// } from './handlers/functions/observable'

class BasedServerClient {
  // must be private probaly
  private _params: Params
  private _noAuth: boolean

  constructor(params: Params, noAuth: boolean = false) {
    this._params = params
    this._noAuth = noAuth
  }

  public opts = {
    cluster: process.env.SERVICE_SELECTOR_LIST,
    org: process.env.ORG,
    project: process.env.PROJECT,
    env: process.env.ENV,
  }

  get state() {
    return this._params.server.state
  }

  get redis(): RedisSelvaClient {
    return this._params.server.db.redis
  }

  public destroy() {
    this._params.server = null
  }

  private _authorize = async (
    type: string,
    payload?: any,
    name?: string
  ): Promise<boolean> => {
    if (this._noAuth) {
      return true
    }
    // fix something for a token user.
    if (
      this._params.server.config?.authorize ||
      this._params.server.config?.functionConfig
    ) {
      const server = this._params.server
      const auth =
        // @ts-ignore
        (name && (await getFunction(server, name))?.authorize) ||
        (await getAuthorize(server))

      if (!auth) {
        return true
      }

      const authorized = await auth(
        new Params(
          server,
          payload,
          this._params.user,
          this._params.callStack,
          null,
          name,
          type,
          true
        )
      )
      if (!authorized) {
        const prettyType = type[0].toLocaleUpperCase() + type.slice(1)
        const err = new Error(
          name
            ? `${prettyType} ${name} unauthorized request`
            : `${prettyType} unauthorized request`
        )
        err.name = 'AuthorizationError'
        throw err
      }
    }
    return true
  }

  public async event(
    type: string,
    params: { [key: string]: string | number | boolean },
    opts?: TrackOpts
  ) {
    await this._authorize('event', { params, opts, type })
    const key = generateTrackingKey(type, params)
    return trackEvent(this._params.server, key, opts, this._params.user.geo.iso)
  }

  public async clearAnalytics(
    type: string,
    params?: { [key: string]: number | string | boolean }
  ) {
    await this._authorize('clearAnalytics', { params, type })
    const key = generateTrackingKey(type, params)
    return deleteEvent(this._params.server, key)
  }

  public observe(
    query: Query,
    onData: (data: any, checksum: number) => void,
    onErr?: (err: Error) => void
  ): Promise<() => void>

  public observe(
    name: string,
    onData: (data: any, checksum: number) => void,
    onErr?: (err: Error) => void
  ): Promise<() => void>

  public observe(
    name: string,
    payload: any,
    onData: (data: any, checksum: number) => void,
    onErr?: (err: Error) => void
  ): Promise<() => void>

  public observe(
    a: string | Query,
    b: any | ((data: any, checksum: number) => void),
    c?: (data: any, checksum: number) => void | ((err: Error) => void),
    d?: (err: Error) => void
  ): Promise<() => void> {
    if (typeof a === 'string') {
      if (typeof b === 'function') {
        const x = c
        c = b
        b = undefined
        // @ts-ignore
        d = x
      }

      return new Promise((resolve, reject) => {
        this._authorize('observe', b, a)
          .then(async () => {
            let initial = false

            // TODO: types
            const f = (data: any, checksum: any, err: any) => {
              if (!initial) {
                if (err) {
                  reject(new Error(err.message))
                  if (d) {
                    d(new Error(err.message))
                  }
                } else {
                  c(data, checksum)
                }
                initial = true
              } else {
                if (err) {
                  if (d) {
                    d(new Error(err.message))
                  }
                } else {
                  c(data, checksum)
                }
              }
            }

            let subscription: any
            try {
              if (a === '$configuration') {
                subscription = await subscribeConfiguration(this._params, f)
              } else {
                subscription = await subscribeFunction(this._params, a, b, f)
              }
            } catch (err) {
              reject(err)
              return
            }
            const close = () => {
              if (subscription) {
                subscription.unsubscribeDataListener(
                  this._params.user,
                  f,
                  this._params.callStack
                    ? this._params.callStack.join('.')
                    : this._params.name
                )
              }
            }

            resolve(close)
          })
          .catch((err) => {
            console.error(err)

            reject(err)
          })
      })
    } else {
      return new Promise((resolve, reject) => {
        // callstack maybe?
        this._authorize('observe', a)
          .then(() => {
            let errored = false
            let first = false
            const x = this._params.server.db.observe(a)

            x.subscribe(
              (y, checksum) => {
                if (errored) {
                  errored = false
                  console.info('RECOVERED FROM ERROR!')
                }

                if (first === null) {
                  return
                }
                if (!first) {
                  first = true
                  resolve(() => {
                    x.unsubscribe()
                  })
                }
                b(y, checksum)
              },
              (err) => {
                if (err.message.includes('ERR_SUBSCRIPTIONS ENOENT')) {
                  //
                  errored = true
                  console.error('ignore error subs enoent')
                  // x.unsubscribe()

                  // resolve
                } else {
                  if (!first) {
                    first = true
                    x.unsubscribe()
                    reject(err)
                  }
                }
              }
            )
          })
          .catch((err) => {
            reject(err)
          })
      })
    }
  }

  public async get(query: GetOptions): Promise<GenericObject>

  public async get(name: string, payload?: any): Promise<GenericObject>

  public async get(
    a: string | GetOptions,
    payload?: any
  ): Promise<GenericObject> {
    return new Promise((resolve, reject) => {
      if (typeof a === 'string') {
        this._authorize('get', payload, a)
          .then(async () => {
            let isFired = false
            // eslint-disable-next-line
            let subscription: any
            // TODO: types
            const f = (data: any, _checksum: any, err: any) => {
              if (err) {
                reject(new Error(err.message))
              } else {
                resolve(data)
              }
              if (subscription) {
                subscription.unsubscribeDataListener(
                  this._params.user,
                  f,
                  this._params.callStack
                    ? this._params.callStack.join('.')
                    : this._params.name
                )
              } else {
                isFired = true
              }
            }

            if (a === '$configuration') {
              subscription = await subscribeConfiguration(this._params, f)
            } else {
              subscription = await subscribeFunction(
                this._params,
                a,
                payload,
                f
              )
            }

            if (isFired && subscription) {
              subscription.unsubscribeDataListener(
                this._params.user,
                f,
                this._params.callStack
                  ? this._params.callStack.join('.')
                  : this._params.name
              )
            }
          })
          .catch((err) => {
            reject(err)
          })
      } else {
        this._authorize('get', a)
          .then(() => {
            resolve(this._params.server.db.get(a))
          })
          .catch((err) => {
            reject(err)
          })
      }
    })
  }

  public async copy(payload: Copy): Promise<{ ids: string[] }> {
    await this._authorize('copy', payload)
    return copy(this._params.server, payload)
  }

  public async id(type: string, opts?: any) {
    let prefix = findPrefix(this._params.server.db, type)
    if (!prefix) {
      await this._params.server.db.getSchema()
      prefix = findPrefix(this._params.server.db, type)
    }
    if (!prefix) {
      throw new Error('Cannot find prefix for id generation')
    }
    if (opts) {
      const optsHash = hashCompact(opts, 8, true)
      return prefix + optsHash
    } else {
      return (
        prefix +
        hashCompact(Math.floor(Math.random() * 99999999999) + '' + Date.now())
      )
    }
  }

  public async call(name: string, payload?: any): Promise<GenericObject> {
    await this._authorize('function', payload, name)
    const server = this._params.server
    const fn = await getFunction(server, name)
    if (fn) {
      return fn.function(
        new Params(server, payload, this._params.user, [
          ...this._params.callStack,
          name,
        ])
      )
    } else {
      const err = new Error(`Function ${name} does not exist`)
      err.name = 'FunctionDoesNotExistError'
    }
  }

  public async delete(payload: {
    $id: string
    $db?: string
  }): Promise<{ isDeleted: boolean }> {
    await this._authorize('delete', payload)
    await this._params.server.db.delete(payload)
    return { isDeleted: true }
  }

  public async set(payload: SetOptions): Promise<{ id: string }> {
    await this._authorize('set', payload)
    const v = await this._params.server.db.set(payload)
    return { id: v }
  }

  public async schema(): Promise<Configuration> {
    await this._authorize('schema')
    console.error('schema not implemented yet')
    const config: Configuration = {
      dbs: [],
      schema: {},
      functions: {},
    }
    const server = this._params.server
    const s = server.db.servers
    if (!server.db.schemas) {
      await server.db.getSchema()
    }
    for (const db in s.origins) {
      config.dbs.push(db)
      if (!server.db.schemas[db]) {
        await server.db.getSchema(db)
      }
      config.schema[db] = server.db.schemas[db]
    }
    return config
  }

  public async updateSchema(configuration: {
    schema?: GenericObject
    db?: string
  }): Promise<GenericObject> {
    await this._authorize('updateSchema')
    this._params.server.db.updateSchema(
      configuration.schema,
      configuration.db || 'default'
    )
    return {}
  }

  public encode(
    payload: string | object,
    privateKeySecret: string | { secret: string } | { key: string },
    type: 'jwt' = 'jwt',
    signOptions?: SignOptions
  ): Promise<string> {
    return encodeValueBySecret(
      this._params.server,
      payload,
      privateKeySecret,
      type,
      signOptions
    )
  }

  public decode(
    payload: string,
    secretOrPublicKey: string | { publicKey: string },
    type: 'jwt' = 'jwt' // get more - can add audience  { audience: 'urn:foo' }
  ): Promise<any> {
    if (typeof secretOrPublicKey === 'string') {
      return decodeValueBySecret(
        this._params.server,
        payload,
        secretOrPublicKey,
        type
      )
    } else if (secretOrPublicKey.publicKey) {
      return decodeToken(payload, secretOrPublicKey.publicKey)
    } else {
      throw new Error('Invalid secretOrPublicKey')
    }
  }

  public async secret(secret: string): Promise<any> {
    return getSecret(this._params.server, secret)
  }

  public async digest(payload: string): Promise<string> {
    // authorize or nah?
    const v = this._params.server.db.digest(payload)
    return v
  }

  public async sendEmail(payload: {
    to: string
    subject: string
    body: string
    from?: string
  }): Promise<{
    status: 'ok'
    message?: string
  }> {
    if (this._params.server.config.sendEmail) {
      const res = await this._params.server.config.sendEmail(payload)
      if (res.status === 'error') {
        throw new Error(res.message)
      }
      return res
    } else {
      throw new Error('send email not configured...')
    }
  }
}

export default BasedServerClient

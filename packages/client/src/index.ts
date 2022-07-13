import Emitter from './Emitter'
import connectWebsocket from './websocket'
import {
  RequestTypes,
  GenericObject,
  Configuration,
  Query,
  DigestOptions,
  SetOptions,
  Copy,
  SendTokenOptions,
  TrackOpts,
  AnalyticsTypes,
  AnalyticsResult,
  AnalyticsOpts,
  AnalyticsTypesOpts,
  isAnalyticsTypesOpts,
  isAnalyticsHistoryOpts,
  AnalyticsHistoryOpts,
  FileUploadOptions,
  FileUploadSrc,
  FileUploadPath,
  FileUploadStream,
  AnalyticsHistoryResult,
  GetOptions,
  RegisterOpts,
  LoginOpts,
} from '@based/types'
import {
  addSubscriber,
  generateSubscriptionId,
  addGetSubscriber,
  removeSubscriber,
} from './subscriptions'
import { addRequest } from './request'
import { BasedClient } from './Client'
import findPrefix from './findPrefix'
import createError from './createError'
import { hashCompact } from '@saulx/hash'
import sendToken from './token'
import track, { genKey as generateTrackingKey } from './track'
import { CompoundObservable, IObservable, Observable } from './observable'
import { login, logout, register } from './auth'
import file from './file'
import getService, { getClusterUrl } from '@based/get-service'
import { deepCopy } from '@saulx/utils'
import {
  BasedGraphQL,
  createOperations,
  parseGraphql,
  handleGraphqlVariables,
} from '@based/graphql'

export * from '@based/types'

export {
  BasedGraphQL,
  createOperations as createGraphqlOperations,
  parseGraphql,
  handleGraphqlVariables,
  generateTrackingKey,
  addSubscriber,
  addGetSubscriber,
  removeSubscriber,
  addRequest,
  generateSubscriptionId,
  BasedClient,
  Observable,
}

export declare interface Based {
  on(event: 'schema', listener: Function): this
  on(event: 'auth', listener: Function): this
  on(event: 'connect', listener: Function): this
  on(event: 'disconnect', listener: Function): this
  on(event: 'reconnect', listener: Function): this
  on(event: 'renewToken', listener: Function): this
  once(event: 'schema', listener: Function): this
  once(event: 'auth', listener: Function): this
  once(event: 'connect', listener: Function): this
  once(event: 'disconnect', listener: Function): this
  once(event: 'reconnect', listener: Function): this
  once(event: 'renewToken', listener: Function): this
}

export class Based extends Emitter {
  public client: BasedClient
  public graphql: {
    query: (
      q: string | BasedGraphQL,
      variables?: Record<string, any>
    ) => Promise<GenericObject>

    live: (
      q: string | BasedGraphQL,
      variables?: Record<string, any>
    ) => Promise<IObservable>
  }

  constructor(opts?: { url: string | (() => Promise<string>) }) {
    super()
    this.client = new BasedClient(this)
    Object.defineProperty(this, 'client', {
      enumerable: false,
      writable: true,
    })
    if (opts && opts.url) {
      this.connect(opts.url)
    }

    this.graphql = {
      query: this.gqlQuery.bind(this),
      live: this.gqlLive.bind(this),
    }
  }

  public connect(url?: string | (() => Promise<string>)) {
    if (!url && this._url) {
      if (!this.client.connection) {
        this.client.connection = connectWebsocket(this.client, this._url)
      }
    } else {
      this._url = url
      this.client.connection = connectWebsocket(this.client, url)
    }
  }

  private _url: string | (() => Promise<string>)

  public opts: BasedOpts

  public disconnect() {
    if (this.client.connection) {
      this.client.connection.disconnected = true
      this.client.connection.destroy()
      if (this.client.connection.ws) {
        this.client.connection.ws.close()
      }
      if (this.client.connected) {
        this.client.onClose()
      }
      delete this.client.connection
    }
    this.client.connected = false
  }

  public observeUntil(
    query: Query,
    condition: (data: GenericObject, checksum: number) => boolean,
    onData?: (data: any, checksum: number) => void
  ): Promise<GenericObject> {
    return new Promise((resolve, reject) => {
      let close
      let isResolved = false
      this.observe(query, (d, checksum) => {
        if (onData) {
          onData(d, checksum)
        }
        if (condition(d, checksum)) {
          isResolved = true
          if (close) {
            close()
          }
          resolve(d)
        }
      })
        .then((c) => {
          if (isResolved) {
            close()
          } else {
            close = c
          }
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  public gql(literals: string | readonly string[], ...args: any[]) {
    if (typeof literals === 'string') {
      literals = [literals]
    }

    let result = literals[0]

    args.forEach((arg, i) => {
      if (arg && arg.kind === 'Document') {
        result += arg.loc.source.body
      } else {
        result += arg
      }
      result += literals[i + 1]
    })

    return createOperations(
      { schemas: this.client.configuration.schema },
      parseGraphql(result)
    )
  }

  public gqlDb(
    db: string = 'default'
  ): (literals: string | readonly string[], ...args: any[]) => BasedGraphQL {
    return (literals, ...args) => {
      if (typeof literals === 'string') {
        literals = [literals]
      }

      let result = literals[0]

      args.forEach((arg, i) => {
        if (arg && arg.kind === 'Document') {
          result += arg.loc.source.body
        } else {
          result += arg
        }
        result += literals[i + 1]
      })

      return createOperations(
        { schemas: this.client.configuration.schema, db },
        parseGraphql(result)
      )
    }
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
      return new Promise((resolve, reject) => {
        const noPayload = typeof b === 'function'
        const onData = noPayload ? b : c
        const onErr = noPayload ? c : d
        addSubscriber(
          this.client,
          noPayload ? undefined : b, // not only query should be any
          <(data: any, checksum: number) => void>onData,
          (err, subscriptionId, subscriberId, _data, isAuthError) => {
            if (err && !isAuthError) {
              // maybe log also
              reject(err)
            } else {
              const unsubscribe = () => {
                removeSubscriber(this.client, subscriptionId, subscriberId)
              }
              resolve(unsubscribe)
            }
          },
          <(err: Error) => void>onErr,
          undefined,
          a
        )
      })
    } else {
      return new Promise((resolve, reject) => {
        addSubscriber(
          this.client,
          a,
          <(data: any, checksum: number) => void>b,
          (err, subscriptionId, subscriberId, _data, isAuthError) => {
            if (err && !isAuthError) {
              // maybe log also
              reject(err)
            } else {
              const unsubscribe = () => {
                removeSubscriber(this.client, subscriptionId, subscriberId)
              }
              resolve(unsubscribe)
            }
          },
          <(err: Error) => void>c
        )
      })
    }
  }

  public createObservable(query: Query): Observable

  public createObservable(name: string, payload?: any): Observable

  public createObservable(a: string | Query, payload?: any): Observable {
    if (typeof a === 'string') {
      return new Observable(this.client, a, payload)
    } else {
      return new Observable(this.client, a)
    }
  }

  public observeSchema(
    name: string,
    onData: (data: any, checksum: number) => void,
    onErr?: (err: Error) => void
  ): Promise<() => void>

  public observeSchema(
    onData: (data: any, checksum: number) => void,
    onErr?: (err: Error) => void
  ): Promise<() => void>

  public observeSchema(
    a: string | ((data: any, checksum: number) => void),
    b: ((data: any, checksum: number) => void) | ((err: Error) => void),
    c?: (err: Error) => void
  ): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const db = typeof a === 'string' ? a : 'default'
      const onData = typeof a === 'string' ? b : a
      const onErr = typeof a === 'string' ? c : b
      addSubscriber(
        this.client,
        { $subscribe_schema: db },
        (data, checksum) => {
          if (!this.client.configuration) {
            this.client.configuration = {
              dbs: [],
              schema: {},
              functions: {},
            } as any // TODO: FIX
          }

          this.client.configuration.schema[db] = data
          onData(data, checksum)
        },
        (err, subscriptionId, subscriberId, _data, isAuthError) => {
          if (err && !isAuthError) {
            // maybe log also
            reject(err)
          } else {
            const unsubscribe = () => {
              removeSubscriber(this.client, subscriptionId, subscriberId)
            }
            resolve(unsubscribe)
          }
        },
        <(err: Error) => void>onErr
      )
    })
  }

  public get(query: Query): Promise<GenericObject>

  public get(name: string, payload?: any): Promise<GenericObject>

  public get(a: string | Query, payload?: any): Promise<GenericObject> {
    if (typeof a === 'string') {
      return new Promise((resolve, reject) => {
        addGetSubscriber(
          this.client,
          payload,
          (err, _subscriber, _subId, data) => {
            if (err) {
              reject(err)
            } else {
              resolve(data)
            }
          },
          0,
          a
        )
      })
    } else {
      return new Promise((resolve, reject) => {
        addRequest(this.client, RequestTypes.Get, a, resolve, reject)
      })
    }
  }

  public file(
    opts:
      | FileUploadOptions
      | File
      | FileUploadSrc
      | FileUploadPath
      | FileUploadStream
  ): Promise<any> {
    if (global.File && opts instanceof File) {
      opts = { contents: opts }
    }
    // @ts-ignore
    return file(this, opts)
  }

  public call(name: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      addRequest(this.client, RequestTypes.Call, payload, resolve, reject, name)
    })
  }

  public async id(type: string, opts?: any) {
    let prefix = findPrefix(this.client, type)
    if (!prefix) {
      await this.schema()
      prefix = findPrefix(this.client, type)
    }
    if (!prefix) {
      throw createError({
        message: `Type does not exist ${type}`,
        type: 'Invalid type',
        payload: opts
          ? { type, opts }
          : {
              type,
            },
      })
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

  public digest(payload: DigestOptions): Promise<{ id: string }> {
    return new Promise((resolve, reject) => {
      addRequest(this.client, RequestTypes.Digest, payload, resolve, reject)
    })
  }

  public set(payload: SetOptions): Promise<{ id: string }> {
    return new Promise((resolve, reject) => {
      addRequest(this.client, RequestTypes.Set, payload, resolve, reject)
    })
  }

  public bulkUpdate(payload: SetOptions, query: any): Promise<{ id: string }> {
    return new Promise((resolve, reject) => {
      addRequest(
        this.client,
        RequestTypes.BulkUpdate,
        { payload, query },
        resolve,
        reject
      )
    })
  }

  public copy(payload: Copy): Promise<{ ids: string[] }> {
    return new Promise((resolve, reject) => {
      addRequest(this.client, RequestTypes.Copy, payload, resolve, reject)
    })
  }

  private async gqlQuery(
    q: string | BasedGraphQL,
    variables: Record<string, any> = {}
  ): Promise<GenericObject> {
    let op: BasedGraphQL
    if (typeof q === 'string') {
      op = this.gql(q)
    } else {
      op = q
    }

    try {
      op = handleGraphqlVariables(op, op, variables)

      if (op.opType === 'GET') {
        const queryObj: GetOptions = { $db: op.db }
        const fnReplies: { key: string; reply: any }[] = []
        for (const key in op.ops) {
          if (op.ops[key].fnObserve) {
            const resp = await this.get(
              <string>op.ops[key].fnObserve.name,
              op.ops[key].fnObserve.payload
            )

            fnReplies.push({ key, reply: resp })
            continue
          }

          if (op.ops[key].get) {
            queryObj[key] = op.ops[key].get
          }
        }

        const getResult = await this.get(queryObj)
        for (const { key, reply } of fnReplies) {
          getResult[key] = reply
        }

        return { data: getResult }
      }

      const reply = {}
      await Promise.all(
        Object.entries(op.ops).map(async ([k, o]) => {
          if (o.delete) {
            reply[k] = await this.delete(o.delete)
            return
          } else if (o.fnCall) {
            reply[k] = await this.call(<string>o.fnCall.name, o.fnCall.payload)
            return
          }

          const { id } = await this.set(o.set)
          if (!o.get) {
            const res: any = {}
            res.id = id

            const type =
              this.client?.configuration?.schema?.[op.db]
                ?.prefixToTypeMapping?.[id.slice(0, 2)]
            if (type) {
              res.type = type
            }

            reply[k] = res
            return
          }

          const getOpts: GetOptions = deepCopy(o.get)
          getOpts.$id = id

          const getData = await this.get(getOpts)
          reply[k] = getData
        })
      )

      return { data: reply }
    } catch (e) {
      return { errors: [{ message: e.message, locations: e.locations }] }
    }
  }

  private async gqlLive(
    q: string | BasedGraphQL,
    variables: Record<string, any> = {}
  ): Promise<IObservable> {
    let op: BasedGraphQL
    if (typeof q === 'string') {
      op = this.gql(q)
    } else {
      op = q
    }

    op = handleGraphqlVariables(op, op, variables)

    if (op.opType === 'GET') {
      const fns: { key: string; fn: { name: string; payload: any } }[] = []
      const queryObj: GetOptions = {}
      for (const key in op.ops) {
        if (op.ops[key].fnObserve) {
          const { name, payload } = op.ops[key].fnObserve
          fns.push({ key, fn: { name: <string>name, payload } })
          continue
        }
        queryObj[key] = op.ops[key].get
      }

      if (fns?.length) {
        const allObs = fns.map((fn) => {
          return {
            obs: new Observable(this.client, <string>fn.fn.name, fn.fn.payload),
            key: fn.key,
          }
        })

        const queryObs = new Observable(this.client, {
          $db: op.db,
          ...queryObj,
        })

        allObs.push({ key: '', obs: queryObs })

        return new CompoundObservable(this.client, allObs)
      }

      return new Observable(this.client, { $db: op.db, data: queryObj })
    }

    const queryObj = {}
    await Promise.all(
      Object.entries(op.ops).map(async ([k, op]) => {
        if (op.delete) {
          queryObj[k] = await this.delete(op.delete)
          return
        } else if (op.fnCall) {
          queryObj[k] = await this.call(
            <string>op.fnCall.name,
            op.fnCall.payload
          )
          return
        }

        const { id } = await this.set(op.set)

        const getOpts: GetOptions = deepCopy(op.get)
        getOpts.$id = id

        queryObj[k] = getOpts
      })
    )

    return new Observable(this.client, { $db: op.db, data: queryObj })
  }

  // will become a special request
  public analytics(opts: AnalyticsHistoryOpts): Promise<AnalyticsHistoryResult>

  public analytics(opts: AnalyticsTypesOpts): Promise<AnalyticsTypes>

  public analytics(opts: AnalyticsOpts): Promise<AnalyticsResult>

  public analytics(
    opts: AnalyticsTypesOpts,
    onData: (data: AnalyticsTypes, checksum: number) => void
  ): Promise<() => void>

  public analytics(
    opts: AnalyticsOpts,
    onData: (data: AnalyticsResult, checksum: number) => void
  ): Promise<() => void>

  public analytics(
    opts: AnalyticsHistoryOpts,
    onData: (data: AnalyticsHistoryResult, checksum: number) => void
  ): Promise<() => void>

  public analytics(
    opts: AnalyticsOpts | AnalyticsTypesOpts | AnalyticsHistoryOpts,
    onData?:
      | ((data: AnalyticsResult, checksum: number) => void)
      | ((data: AnalyticsTypes, checksum: number) => void)
      | ((data: AnalyticsHistoryResult, checksum: number) => void)
  ): Promise<
    (() => void) | AnalyticsResult | AnalyticsTypes | AnalyticsHistoryResult
  > {
    return new Promise((resolve, reject) => {
      if (onData) {
        addSubscriber(
          this.client,
          opts,
          onData,
          (err, subscriptionId, subscriberId, _data, isAuthError) => {
            if (err && !isAuthError) {
              reject(err)
            } else {
              const unsubscribe = () => {
                removeSubscriber(this.client, subscriptionId, subscriberId)
              }
              resolve(unsubscribe)
            }
          },
          (err) => console.error(err),
          undefined,
          'analytics'
        )
      } else {
        addGetSubscriber(
          this.client,
          opts,
          (err, _subscriber, _subId, data) => {
            if (err) {
              reject(err)
            } else {
              if (isAnalyticsHistoryOpts(opts)) {
                resolve(data as AnalyticsHistoryResult)
              } else if (isAnalyticsTypesOpts(opts)) {
                resolve(data as AnalyticsTypes)
              } else {
                resolve(data as AnalyticsResult)
              }
            }
          },
          0,
          'analytics'
        )
      }
    })
  }

  public track(
    type: string,
    params?: { [key: string]: number | string | boolean }
  ): void {
    track(this.client, type, params)
  }

  public clearAnalytics(
    type: string,
    params?: { [key: string]: number | string | boolean }
  ): void {
    track(this.client, type, params, false, false, undefined, true)
  }

  public untrack(
    type: string,
    params?: { [key: string]: number | string | boolean }
  ): void {
    track(this.client, type, params, true)
  }

  public event(
    type: string,
    params?: { [key: string]: number | string | boolean },
    opts?: TrackOpts
  ): void {
    track(this.client, type, params, false, true, opts)
  }

  public delete(payload: {
    $id: string
    $db?: string
  }): Promise<{ isDeleted: boolean }> {
    return new Promise((resolve, reject) => {
      addRequest(this.client, RequestTypes.Delete, payload, resolve, reject)
    })
  }

  public schema(): Promise<Configuration> {
    return new Promise((resolve, reject) => {
      const resolver = (config: Configuration) => {
        this.client.configuration = config
        resolve(config)
      }
      addRequest(
        this.client,
        RequestTypes.GetConfiguration,
        0,
        resolver,
        reject
      )
    })
  }

  public removeType(
    type: string,
    db: string = 'default'
  ): Promise<{ removed: boolean }> {
    return new Promise((resolve, reject) => {
      addRequest(
        this.client,
        RequestTypes.RemoveType,
        { type, db },
        resolve,
        reject
      )
    })
  }

  public removeField(
    type: string,
    path: string | string[],
    db: string = 'default'
  ): Promise<{ removed: boolean }> {
    return new Promise((resolve, reject) => {
      if (!path || path.length === 0) {
        reject(new Error('Path cannot be empty'))
      } else {
        if (!Array.isArray(path)) {
          path = [path]
        }

        addRequest(
          this.client,
          RequestTypes.RemoveField,
          { type, db, path },
          resolve,
          reject
        )
      }
    })
  }

  public updateSchema(
    configuration:
      | {
          schema?: GenericObject // FOR NOW
          db?: string
        }
      | {
          schema?: GenericObject // FOR NOW
          db?: string
        }[]
  ): Promise<GenericObject> {
    return new Promise((resolve, reject) => {
      addRequest(
        this.client,
        RequestTypes.Configuration,
        configuration,
        resolve,
        reject
      )
    })
  }

  public getToken() {
    return this.client.token
  }

  // allow localstorage
  public auth(
    token: string | false,
    options?: SendTokenOptions
  ): Promise<false | string | number> {
    return new Promise((resolve) => {
      if (token && token === this.client.token) {
        if (!this.client.beingAuth) {
          resolve(token)
        } else {
          this.client.auth.push((v) => {
            if (v) {
              resolve(token)
            } else {
              resolve(false)
            }
          })
        }
      } else {
        this.client.auth.push(resolve)
        if (
          (token && token !== this.client.token) ||
          (token === false && this.client.token)
        ) {
          if (typeof token === 'string') {
            const { renewOptions, refreshToken, ...redactedOptions } =
              options || {}
            if (renewOptions) {
              this.client.renewOptions = renewOptions
            }
            if (refreshToken) {
              this.client.renewOptions = {
                ...this.client.renewOptions,
                refreshToken,
              }
            }
            sendToken(this.client, token, redactedOptions)
          } else {
            // this is very important
            // may need to add a req Id (and a timer how long it takes)
            sendToken(this.client)
          }
          this.emit('auth', token)
        }
      }
    })
  }

  // observeAuth

  public async login(
    opts: LoginOpts & { localStorage?: boolean }
  ): Promise<GenericObject> {
    if (opts.localStorage === false) {
      this.client.tokenToLocalStorage = false
    } else {
      this.client.tokenToLocalStorage = true
    }
    return login(this.client, opts)
  }

  public async register(
    opts: RegisterOpts & { localStorage?: boolean }
  ): Promise<GenericObject> {
    if (opts.localStorage === false) {
      this.client.tokenToLocalStorage = false
    } else {
      this.client.tokenToLocalStorage = true
    }
    return register(this.client, opts)
  }

  public logout(): Promise<GenericObject> {
    return logout(this.client)
  }

  public observeAuth(
    userDataListener: (
      data:
        | {
            id: string
            token: string
          }
        | false
    ) => void
  ): Promise<() => void> {
    return new Promise((resolve) => {
      // store a user state somehwere..

      if (this.client.user && this.client.token) {
        userDataListener({
          id: this.client.user,
          token: this.client.token,
        })
      } else {
        userDataListener(false)
      }

      const authListener = (d) => {
        if (d && this.client.user && this.client.token) {
          userDataListener({
            id: this.client.user,
            token: this.client.token,
          })
        } else {
          userDataListener(false)
        }
      }

      this.on('auth', authListener)

      resolve(() => {
        this.removeListener('auth', authListener)
      })
    })
  }
}

// auth as admin // auth as based

const addParamsToUrl = (url, params) => {
  if (params) {
    let firstChecked
    url += /\?/.test(url) ? '&' : '?'
    for (const key in params) {
      const value = params[key]
      url += firstChecked ? `&${key}=${value}` : `${key}=${value}`
      firstChecked = true
    }
  }

  return url
}

export type BasedOpts = {
  env?: string
  project?: string
  org?: string
  cluster?: string
  name?: string
  key?: string
  url?: string | (() => Promise<string>)
  params?: {
    [key: string]: string | number
  }
}

const based = (opts: BasedOpts, BasedClass = Based): Based => {
  let {
    env,
    project,
    org,
    url,
    key,
    name = '@based/hub',
    cluster,
    params,
  } = opts

  /*
  observeSchema

  */

  if (!url) {
    cluster = opts.cluster = getClusterUrl(cluster)

    url = async () => {
      const { url } = await getService(
        {
          env,
          project,
          org,
          key,
          name,
        },
        0,
        cluster
      )
      return addParamsToUrl(url, params)
    }
  }

  if (url) {
    const client = new BasedClass()
    client.opts = opts
    client.client.initUserState()
    client.connect(url)
    return client
  }
}

export default based

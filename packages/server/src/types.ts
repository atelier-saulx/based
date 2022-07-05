import Client from './Client'
import uws from '@based/uws'
import { ConnectOptions } from '@saulx/selva'
import Based from './BasedServerClient'
import { Params } from './Params'
import { BasedServer } from '.'
import {
  ErrorObject,
  GenericObject,
  Based as BasedAdminClient,
} from '@based/client'
import { Readable } from 'stream'

export { Client }

export type CallParams = Omit<Params, 'update'>

export type DataListener = (
  data: GenericObject,
  checksum: number,
  error?: ErrorObject
) => void

export type ObservableFunction = {
  function: (params: Params) => Promise<() => void>
  authorize?: (params: CallParams) => Promise<boolean>
  observable: true
  shared: boolean
  cnt?: number
  worker?: boolean
}

export type CallFunction = {
  observable: false
  authorize?: (params: CallParams) => Promise<boolean>
  function: (params: CallParams) => Promise<any>
  cnt?: number
  worker?: boolean
  headers?: (
    params: CallParams,
    result: any
  ) => Promise<{
    [key: string]: string
  }>
}

export const isCallFunction = (
  fn: CallFunction | ObservableFunction
): fn is CallFunction => {
  return fn.observable === false
}

export const isObservableFunction = (
  fn: CallFunction | ObservableFunction
): fn is ObservableFunction => {
  return fn.observable === true
}

export type AuthorizeFn = (params: Params) => Promise<boolean>

export type LoginFn = (params: Params) => Promise<GenericObject>
export type LogoutFn = (params: Params) => Promise<GenericObject>
export type RenewTokenFn = (params: Params) => Promise<GenericObject>
export type FileOpts = {
  based: Based
  stream: Readable
  mimeType: string
  id: string
  extension: string
  size: number
}

export type GetInitial = (
  server: BasedServer,
  name: string
) => Promise<ObservableFunction | CallFunction | null>

export type Geo = {
  iso: string
  long: number
  lat: number
  regions: string[]
}

export type Config = {
  noAuth?: boolean
  getBasedKey?: () => Promise<string>

  getApiKeysPublicKey?: () => Promise<string>

  getGeo?: (ip: string) => Geo

  /*
       sendEmail: async ({ to, subject, body, from }) => {
        // add validation later
        return {
          status: 1,
          message: `Send email to ${to} from ${from} subject ${subject} body ${body}`,
        }
      },
  */

  sendEmail?: (payload: {
    to: string
    subject: string
    body: string
    from?: string
  }) => Promise<
    | {
        status: 'ok'
        message?: string
      }
    | { status: 'error'; message: string }
  >

  // allow overwrite of this function (from a function then if that function gets access to the 'default')
  storeFile?: (opts: FileOpts) => Promise<{
    src: string
    origin: string
    status: number
    statusText?: string
    thumb?: string
    version?: string
    mimeType?: string
  }>

  deleteFile?: (opts: {
    based: Based
    id: string
    db?: string
  }) => Promise<boolean>

  getAdmin?: (key: string) => Promise<BasedAdminClient>

  functionConfig?: {
    idleTimeout: number
    getInitial: GetInitial
    subscribeFunctions: (
      cb: (err: Error, d?: any) => void
    ) => Promise<() => void>
    clear: (server: BasedServer, name: string) => Promise<void>
  }

  secretsConfig?: {
    secretTimeouts?: { [name: string]: number }
    idleTimeout: number
    getInitial: (server: BasedServer, name: string) => Promise<string | null>
    clear: (server: BasedServer, name: string) => Promise<void>
  }

  secrets?: {
    [key: string]: any
  }

  authorizeConnection?: Authorize

  // if functions have authorize then add an empty function for this that returns true
  authorize?: AuthorizeFn
  defaultAuthorize?: AuthorizeFn

  login?: LoginFn
  logout?: LogoutFn
  renewToken?: RenewTokenFn

  functions?: {
    [key: string]: ObservableFunction | CallFunction
  }

  // is this nice syntax?
  onOpen?: (...args: any[]) => void
  onClose?: (...args: any[]) => void
}

export type Authorize = (
  req: uws.HttpRequest,
  // eslint-disable-next-line
  ctx: uws.us_socket_context_t
) => Promise<boolean>

export type ServerOptions = {
  port?: number
  useLessMemory?: boolean
  key?: string
  cert?: string
  debug?: boolean
  db: ConnectOptions
  config?: Config
  state?: GenericObject
}

export type SendTokenOptions = {
  isBasedUser?: boolean
  isApiKey?: boolean
}

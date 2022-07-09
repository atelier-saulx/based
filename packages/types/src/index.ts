import type { GetOptions, Filter } from './selvaTypes/get'
import type { SetOptions } from './selvaTypes/set'
import type { DeleteOptions } from './selvaTypes/delete'
import type { Schema } from './selvaTypes/schema'
import { Readable } from 'stream'

export { GetOptions, SetOptions, DeleteOptions, Schema, Filter }
export * from './selvaTypes/schema'

export type DigestOptions = string

// eslint-disable-next-line
export enum RequestTypes {
  // eslint-disable-next-line
  Subscription = 1,
  // eslint-disable-next-line
  SubscriptionDiff = 2,
  // eslint-disable-next-line
  SendSubscriptionData = 3,
  // eslint-disable-next-line
  Unsubscribe = 4,
  // eslint-disable-next-line
  Set = 5,
  // eslint-disable-next-line
  Get = 6,
  // eslint-disable-next-line
  Configuration = 7,
  // eslint-disable-next-line
  GetConfiguration = 8,
  // eslint-disable-next-line
  Call = 9,
  // eslint-disable-next-line
  GetSubscription = 10,
  // eslint-disable-next-line
  Delete = 11,
  // eslint-disable-next-line
  Copy = 12,
  // eslint-disable-next-line
  Digest = 13,
  // eslint-disable-next-line
  Token = 14,
  // eslint-disable-next-line
  Track = 15,
  // eslint-disable-next-line
  RemoveType = 16,
  // eslint-disable-next-line
  RemoveField = 17,
  // eslint-disable-next-line
  Auth = 18,
}

export enum AuthRequestTypes {
  // eslint-disable-next-line
  Login = 1,
  // eslint-disable-next-line
  Logout = 2,
  // eslint-disable-next-line
  RenewToken = 3,
}

export type FunctionConfig = {
  [name: string]: {
    types?: any
    version: string
    observable: boolean
    shared: boolean
  }
}

export type Configuration = {
  schema: { [db: string]: Schema }
  functions: FunctionConfig
  dbs: string[]
}

export type Query = GetOptions

// make this into Qeury
export type GenericObject = { [key: string]: any }

export type Copy = {
  $id: string
  db?: string
  deep?: boolean
  parents?: string[]
  excludeFields?: string[]
}

export enum BasedErrorCodes {
  TokenExpired = 401,
}

export class BasedError extends Error {
  public type: string
  public query?: GenericObject
  public payload?: any
  public auth?: boolean
  public code?: BasedErrorCodes
}

export type ErrorObject = {
  type: string
  message: string
  name?: string
  query?: GenericObject
  payload?: any
  auth?: boolean
  code?: BasedErrorCodes
}

// outgoing data
export type FunctionCallMessage = [RequestTypes.Call, string, number, any?]

export type TrackMessage = [RequestTypes.Track, TrackPayload]

export type RequestMessage<T = GenericObject> =
  | [
      (
        | RequestTypes.Set
        | RequestTypes.Get
        | RequestTypes.Configuration
        | RequestTypes.GetConfiguration
        | RequestTypes.Delete
        | RequestTypes.Copy
        | RequestTypes.Digest
        | RequestTypes.RemoveType
        | RequestTypes.RemoveField
      ),
      number,
      T
    ]

// extra arg isBasedUser
export type TokenMessage = [RequestTypes.Token, string?, boolean?]

export type AuthMessage = [
  RequestTypes.Auth,
  AuthRequestTypes,
  number,
  GenericObject?
]

export type SubscribeMessage = [
  // request type
  RequestTypes.Subscription,
  // sub scription id
  number,
  // query
  GenericObject?,
  // checksum
  number?,
  // type of request
  // 0 = don't send data back if the same checksum but make subscription
  // 2 = allways send data back, make subscription
  // 1 = send data back, do not make a subscription
  (2 | 1 | 0)?,
  // custom observable function
  string?
]

export type SendSubscriptionDataMessage = [
  // request type
  RequestTypes.SendSubscriptionData,
  // subscription id
  number,
  // checksum
  number?
]

export type SendSubscriptionGetDataMessage = [
  // request type
  RequestTypes.GetSubscription,
  // subscription id
  number,
  // query
  GenericObject?,
  // checksum
  number?,
  // name of custom observable function
  string?
]

export type UnsubscribeMessage = [
  // request type
  RequestTypes.Unsubscribe,
  // subscription id
  number
]

export type SubscriptionMessage =
  | SubscribeMessage
  | SendSubscriptionDataMessage
  | UnsubscribeMessage
  | SendSubscriptionGetDataMessage

export type Message =
  | RequestMessage
  | SubscriptionMessage
  | FunctionCallMessage
  | AuthMessage

// incoming data

export type SubscriptionDiffData = [
  // reply type
  RequestTypes.SubscriptionDiff,
  // id
  number,
  // patch obect
  GenericObject,
  // previous checksum, current checksum
  [number, number]
]

// can also send you allready have it
export type SubscriptionData = [
  RequestTypes.Subscription, // subscription id
  number, // id
  GenericObject, // data
  number?, // checksum
  (BasedError | ErrorObject)? // error
]

export type RequestData = [
  (
    | RequestTypes.Set
    | RequestTypes.Get
    | RequestTypes.Configuration
    | RequestTypes.GetConfiguration
    | RequestTypes.Call
    | RequestTypes.Delete
    | RequestTypes.Copy
    | RequestTypes.Digest
    | RequestTypes.RemoveType
    | RequestTypes.RemoveField
  ),
  // callback id
  number,
  // payload
  any,
  // error
  (BasedError | ErrorObject)? // error
]

// token is a string, de-authroized subcrption ids
export type AuthorizedData = [RequestTypes.Token, number[], boolean?]

export type AuthData = [
  RequestTypes.Auth,
  number,
  GenericObject,
  (BasedError | ErrorObject)? // error
]

export type ResponseData =
  | SubscriptionDiffData
  | SubscriptionData
  | RequestData
  | AuthorizedData
  | AuthData

export type TrackPayload = {
  t: string
  u?: 1
  s?: 1
  e?: 1
  r?: 1
  o?: TrackOpts
}

export type TrackOpts = {
  amount?: number
}

export type SendTokenOptions = {
  isBasedUser?: boolean
  isApiKey?: boolean
  refreshToken?: string
  renewOptions?: {
    refreshToken?: string
  } & { [key: string]: any }
}

export type AnalyticsResult = {
  all: {
    total: number
    geo?: { [isoCode: string]: number }
  }
  unique: {
    total: number
    geo?: { [isoCode: string]: number }
  }
  active: {
    total: number
    max: number
    geo?: { [isoCode: string]: number }
  }
}

export type AnalyticsHistoryResult = {
  all: {
    total: [number, number][]
    geo?: { [isoCode: string]: [number, number][] }
  }
  unique: {
    total: [number, number][]
    geo?: { [isoCode: string]: [number, number][] }
  }
  active: {
    total: [number, number][]
    // max: [number, number][]
    geo?: { [isoCode: string]: [number, number][] }
  }
}

export type AnalyticsTypes = string[]

export type AnalyticsTypesOpts = {
  type?: string
  $types: true
}

export function isAnalyticsTypesOpts(
  opts: AnalyticsOpts | AnalyticsTypesOpts
): opts is AnalyticsTypesOpts {
  return (opts as AnalyticsTypesOpts).$types === true
}

export function isAnalyticsHistoryOpts(
  opts: AnalyticsOpts | AnalyticsTypesOpts
): opts is AnalyticsHistoryOpts {
  const hasHistory = (opts as AnalyticsHistoryOpts).$history
  return !!hasHistory
}

export type AnalyticsOpts = {
  type: string
  params?: { [key: string]: number | string | boolean }
  $geo?: string[] | boolean
}

export type AnalyticsHistoryOpts = {
  type: string
  params?: { [key: string]: number | string | boolean }
  $geo?: string[] | boolean
  $history: boolean | number
}

export type LoginOpts = {
  email: string
  password: string
}
export type RenewTokenOpts = {
  refreshToken?: string
} & { [key: string]: any }

export type FileUploadOptions = {
  contents: Buffer | ArrayBuffer | string | File | Blob
  mimeType?: string
  name?: string
  url?: string | (() => Promise<string>)
  id?: string
  raw?: boolean
  parents?: string[]
  functionName?: string
}

export type FileUploadStream = {
  contents: Readable
  mimeType?: string
  extension?: string
  size: number
  name?: string
  url?: string | (() => Promise<string>)
  id?: string
  raw?: boolean
  parents?: string[]
  functionName?: string
}

export type FileUploadPath = {
  path: string
  mimeType?: string
  extension?: string
  name?: string
  url?: string | (() => Promise<string>)
  id?: string
  raw?: boolean
  parents?: string[]
  functionName?: string
}

export type FileUploadSrc = {
  src: string // url
  mimeType?: string
  name?: string
  id?: string
  parents?: string[]
  size?: number
}

export type AuthLoginFunctionResponse = {
  id: string
  email: string
  name: string
  token: string
  tokenExpiresIn?: number
  refreshToken: string
  refreshTokenExpiresIn?: number
}

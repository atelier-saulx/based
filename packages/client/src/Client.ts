import { Connection } from './websocket/types'
import {
  RequestTypes,
  GenericObject,
  RequestMessage,
  ResponseData,
  SubscriptionMessage,
  FunctionCallMessage,
  Configuration,
  TrackMessage,
  SendTokenOptions,
  AuthMessage,
  BasedErrorCodes,
  BasedError,
  ErrorObject,
} from '@based/types'
import {
  incomingSubscription,
  incomingSubscriptionDiff,
  sendAllSubscriptions,
  removeUnsubscribesFromQueue,
  logoutSubscriptions,
  removeSendSubsriptionDataFromQueue,
} from './subscriptions'
import { Based } from './'
import { addToQueue, drainQueue, stopDrainQueue } from './queue'
import { addRequest, incomingRequest } from './request'
import sendToken from './token'
import { incomingAuthRequest, renewToken } from './auth'
import defaultDebug from './debug'
import { decode } from '@based/protocol/dist/decode'

// import avro from 'avro-js'

// const subType = avro.parse({
//   name: 'Subscription',
//   type: 'record',
//   fields: [
//     { name: 'id', type: 'long' },
//     { name: 'version', type: 'long' },
//     { name: 'data', type: 'string' }, // can type it for queries
//   ],
// })

// const subDiffType = avro.parse({
//   name: 'SubscriptionDiff',
//   type: 'record',
//   fields: [
//     { name: 'id', type: 'long' },
//     { name: 'version', type: 'long' },
//     { name: 'fromVersion', type: 'long' },
//     { name: 'data', type: 'string' }, // can type it for queries - which is AMAZING
//   ],
// })

export * from '@based/types'

export class BasedClient {
  public based: Based

  constructor(based: Based) {
    this.based = based
  }

  debugInternal?: (message: any, type: 'incoming' | 'outgoing') => void

  get debug() {
    return this.debugInternal
  }

  set debug(v: true | ((message: any, type: 'incoming' | 'outgoing') => void)) {
    if (v === true) {
      this.debugInternal = defaultDebug
    } else {
      this.debugInternal = v
    }
  }

  token: string

  renewOptions: {
    refreshToken?: string
  } & { [key: string]: any }

  sendTokenOptions: SendTokenOptions

  retryingRenewToken: boolean

  beingAuth: boolean

  // later make silky smooth.....
  isLogginIn: boolean

  auth: ((x?: any) => void)[] = []

  subscriptions: {
    [subscriptionId: string]: {
      authError?: {
        token: string | false
        error: Error
      }
      cnt: number
      query: GenericObject
      name?: string
      subscribers: {
        [cnt: string]: {
          onInitial?: (
            err: Error | null,
            subscriptionId?: number,
            subscriberId?: number,
            data?: GenericObject,
            isAuthError?: boolean
          ) => void
          onError?: (err: Error) => void
          onData?: (data: any, checksum: number) => void
        }
      }
    }
  } = {}

  cache: {
    [queryId: string]: {
      value: any
      checksum: number
    }
  } = {}

  requestCallbacks: {
    // can do the same - resend
    [reqId: string]: {
      resolve: (val?: any) => void
      reject: (err: Error) => void
      // TODO: check with Jim
      type?: Exclude<
        RequestTypes,
        | RequestTypes.Subscription
        | RequestTypes.SubscriptionDiff
        | RequestTypes.SendSubscriptionData
        | RequestTypes.Unsubscribe
        | RequestTypes.GetSubscription
        | RequestTypes.Token
        | RequestTypes.Track
      >
      payload?: any
      name?: string
      isRetry?: boolean
    }
  } = {}

  authCallbacks: {
    // can do the same - resend
    [reqId: string]: {
      resolve: (val?: any) => void
      reject: (err: Error) => void
    }
  } = {}

  tracking: Set<string>

  configuration: Configuration

  connected: boolean = false

  connection: Connection // needs to be a class

  subscriptionQueue: SubscriptionMessage[] = []

  // and more
  queue: (RequestMessage | FunctionCallMessage | TrackMessage | AuthMessage)[] =
    []

  drainInProgress: boolean = false

  drainTimeout: ReturnType<typeof setTimeout>

  idlePing: ReturnType<typeof setTimeout>

  onClose() {
    this.connected = false
    stopDrainQueue(this)
    removeUnsubscribesFromQueue(this)
    removeSendSubsriptionDataFromQueue(this)
    // removeSendSubsriptionDataFromQueue
    if (this.based.listeners.disconnect) {
      this.based.listeners.disconnect.forEach((val) => val())
    }
  }

  onReconnect() {
    if (this.based.listeners.reconnect) {
      this.based.listeners.reconnect.forEach((val) => val())
    }
    if (this.tracking) {
      for (const k of this.tracking) {
        addToQueue(this, [RequestTypes.Track, { t: k }])
      }
    }
  }

  onOpen() {
    this.connected = true
    if (this.based.listeners.connect) {
      this.based.listeners.connect.forEach((val) => val())
    }
    if (this.token) {
      sendToken(this, this.token, this.sendTokenOptions)
    }

    sendAllSubscriptions(this)
    drainQueue(this)
  }

  onData(d) {
    try {
      // if (d.)

      let data: ResponseData
      if (d.data instanceof Blob) {
        data = decode(d.data)
      } else {
        data = JSON.parse(d.data)
      }

      if (this.debugInternal) {
        this.debugInternal(data, 'incoming')
      }

      const [type, reqId, payload, err, subscriptionErr] = data
      if (type === RequestTypes.Token) {
        this.retryingRenewToken = false
        // means stomething got de-auth wrong
        if (reqId.length) {
          logoutSubscriptions(this, data)
        }
        for (const fn of this.auth) {
          fn(!payload)
        }
        this.beingAuth = false
        this.auth = []
      } else if (type === RequestTypes.Auth) {
        incomingAuthRequest(this, data)
      } else {
        if (
          // TODO: Find where expired token is not returning a code
          (((subscriptionErr || err) as BasedError)?.code ===
            BasedErrorCodes.TokenExpired ||
            ((subscriptionErr || err) as BasedError)?.message ===
              'Token expired') &&
          !this.retryingRenewToken
        ) {
          this.retryingRenewToken = true
          renewToken(this, this.renewOptions)
            .then((result) => {
              sendToken(this, result.token, this.sendTokenOptions)
              if (
                type === RequestTypes.Subscription ||
                type === RequestTypes.SubscriptionDiff
              ) {
                // TODO: Check this with Jim
                // should it be the individual subscription?
                sendAllSubscriptions(this)
              } else {
                addRequest(
                  this,
                  // @ts-ignore
                  type,
                  (err as ErrorObject)?.payload,
                  this.requestCallbacks[reqId].resolve,
                  this.requestCallbacks[reqId].reject
                )
              }
              this.based.emit('renewToken', result)
            })
            .catch((err) => {
              this.requestCallbacks[reqId]?.reject(err)
            })
        } else {
          if (
            type === RequestTypes.Set ||
            type === RequestTypes.Get ||
            type === RequestTypes.Configuration ||
            type === RequestTypes.GetConfiguration ||
            type === RequestTypes.Call ||
            type === RequestTypes.Delete ||
            type === RequestTypes.Copy ||
            type === RequestTypes.Digest ||
            type === RequestTypes.RemoveType ||
            type === RequestTypes.RemoveField
          ) {
            incomingRequest(this, data)
          } else if (type === RequestTypes.Subscription) {
            incomingSubscription(this, data)
          } else if (type === RequestTypes.SubscriptionDiff) {
            incomingSubscriptionDiff(this, data)
          }
        }
      }
    } catch (err) {
      console.error('Received incorrect data ', d.data)
    }
  }
}

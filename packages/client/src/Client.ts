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
import { incomingRequest } from './request'
import sendToken from './token'

export * from './types'

export class BasedClient {
  public based: Based

  constructor(based: Based) {
    this.based = based
  }

  token: string
  sendTokenOptions: SendTokenOptions

  beingAuth: boolean

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
    }
  } = {}

  tracking: Set<string>

  configuration: Configuration

  connected: boolean = false

  connection: Connection // needs to be a class

  subscriptionQueue: SubscriptionMessage[] = []

  // and more
  queue: (RequestMessage | FunctionCallMessage | TrackMessage)[] = []

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
      const data: ResponseData = JSON.parse(d.data)
      if (data[0] === RequestTypes.Token) {
        // means stomething got de-auth wrong
        if (data[1].length) {
          logoutSubscriptions(this, data)
        }

        // console.info(data, data[2])
        for (const fn of this.auth) {
          fn(!data[2])
        }
        this.beingAuth = false
        this.auth = []
      } else if (
        data[0] === RequestTypes.Set ||
        data[0] === RequestTypes.Get ||
        data[0] === RequestTypes.Configuration ||
        data[0] === RequestTypes.GetConfiguration ||
        data[0] === RequestTypes.Call ||
        data[0] === RequestTypes.Delete ||
        data[0] === RequestTypes.Copy ||
        data[0] === RequestTypes.Digest
      ) {
        incomingRequest(this, data)
      } else if (data[0] === RequestTypes.Subscription) {
        incomingSubscription(this, data)
      } else if (data[0] === RequestTypes.SubscriptionDiff) {
        incomingSubscriptionDiff(this, data)
      }
    } catch (err) {
      console.error('Received incorrect data ', d)
    }
  }
}

import { AuthState } from './auth'

// incoming
//   0 = function
//   1 = subscription
//   2 = subscriptionDiff
//   3 = get
//   4 = authData
//   5 = errorData
//   6 = channelMessage
//   7 = requesChannelName

// outgoing
//   0 = function
//   1 = subscribe
//   2 = unsubscribe
//   3 = get from observable
//   4 = auth
//   5 = subscribeChannel
//   6 = publishChannel
//   7 = unsubscribeChannel

type DebugEvent =
  | {
      type:
        | 'function'
        | 'subscribe'
        | 'subscriptionDiff'
        | 'get'
        | 'auth'
        | 'error'
        | 'channelMessage'
        | 'requesChannelName'
      direction: 'incoming'
      payload?: any
      id?: number
      info: { name?: string; id?: number; payload?: any }
      msg?: string
      checksum?: number
    }
  | {
      type:
        | 'function'
        | 'subscribe'
        | 'unsubscribe'
        | 'get'
        | 'auth'
        | 'subscribeChannel'
        | 'publishChannel'
        | 'unsubscribeChannel'
        | 'registerChannelId'
      direction: 'outgoing'
      payload?: any
      info: { name?: string; id?: number; payload?: any }
      msg?: string
      checksum?: number
    }

export type EventMap = {
  reconnect: true
  disconnect: true
  connect: true
  debug: DebugEvent
  'authstate-change': AuthState
}

export type Event = keyof EventMap

export type Listener<T> = (data: T) => void

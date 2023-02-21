import { AuthState } from './auth'

export type EventMap = {
  reconnect: true
  disconnect: true
  connect: true
  debug: {
    //   0 = functionData
    //   1 = subscriptionData
    //   2 = subscriptionDiffData
    //   3 = get
    //   4 = authData
    //   5 = errorData
    //   6 = channelMessage
    //   7 = requesChannelName
    type: string
    header: { type: number; isDeflate: boolean; len: number }
    len: number
    payload: any
    direction: 'outgoing' | 'incoming'
  }
  'authstate-change': AuthState
}

export type Event = keyof EventMap

export type Listener<T> = (data: T) => void

import { BasedServer } from '../../server.js'
import { WebSocketSession, Context } from '@based/functions'

export type BinaryMessageHandler = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ctx: Context<WebSocketSession>,
  server: BasedServer,
) => boolean

export enum incomingFunctionType {
  function = 0,
  subscribe = 1,
  unsubscribe = 2,
  get = 3,
  auth = 4,
  channelSubscribe = 5,
  channelPublish = 6,
  subType = 7,
}

export enum incomingFunctionSubType {
  channelUnsubscribe = 0,
  registerStream = 1,
  chunk = 2,
}

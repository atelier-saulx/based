import { Command } from './protocol/types.js'

export type CommandResponseListeners = Map<
  number,
  [(val?: any) => void, (err: Error) => void]
>

export type SubscriptionHandlers = Map<
  number, // seqno
  number // channel id, is a 32 bit int (unsigned)
>

export type CommandQueueItem = { seqno: number; command: Command; payload: any }
export type CommandQueue = CommandQueueItem[]

export type IncomingMessageBuffers = Map<number, { ts: Number; bufs: Buffer[] }>

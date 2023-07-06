import { Command } from './protocol/types'

export type CommandResponseListeners = Map<
  number,
  [(val?: any) => void, (err: Error) => void]
>

export type CommandQueueItem = { seqno: number; command: Command; payload: any }
export type CommandQueue = CommandQueueItem[]

export type IncomingMessageBuffers = Map<number, { ts: Number; bufs: Buffer[] }>

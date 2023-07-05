export enum Command {}

export type CommandResponseListeners = Map<
  number,
  [(val?: any) => void, (err: Error) => void]
>

export type CommandQueueItem = [number, string, any]
export type CommandQueue = CommandQueueItem[]

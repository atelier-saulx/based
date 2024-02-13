export type StreamQueueItem =
  | [
      1, // register id
      number, // reqId
      number, // contentSize
      string, // name
      string, // mimeType
      string, // fnName
      any // payload
    ]
  | [
      2, // chunk
      number, // reqId,
      number, // seq,
      Uint8Array // contents
    ]

export type StreamQueue = StreamQueueItem[]

export type StreamFunctionResponseListeners = Map<
  number,
  [
    (val?: any) => void,
    (err: Error) => void,
    (seqId: number, code: number) => void
  ]
>

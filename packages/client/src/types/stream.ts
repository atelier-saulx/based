export type StreamQueueItem =
  | [
      1, // register id
      number, // reqId
      number, // contentSize
      string, // name
      string, // mimeType
      any // payload
    ]
  | [
      2, // chunk
      number, // reqId,
      number, // seq,
      ArrayBuffer // contents
    ]

export type StreamQueue = StreamQueueItem[]

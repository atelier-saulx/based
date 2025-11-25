export type ReadableStream = {
  pipe: (x: any) => ReadableStream
  // readable?: true
  // _readableState?: object
}

export type ProgressListener = (progress: number, files: number) => void

export type StreamFunctionContents<
  F = Buffer | Uint8Array | string | File | Blob
> = {
  contents: F
  payload?: any
  mimeType?: string
  fileName?: string
  serverKey?: string
  extension?: string
  size?: number
}

export const isFileContents = (
  contents: StreamFunctionContents
): contents is StreamFunctionContents<File> => {
  return contents.contents instanceof File
}

export type StreamFunctionStream = {
  contents: ReadableStream
  payload?: any
  size: number
  mimeType?: string
  fileName?: string
  serverKey?: string
  extension?: string
}

export type StreamFunctionPath = {
  path: string
  payload?: any
  mimeType?: string
  fileName?: string
  serverKey?: string
}

export type StreamFunctionOpts =
  | StreamFunctionPath
  | StreamFunctionContents
  | StreamFunctionStream

const isStream = (stream: any): boolean => {
  return (
    stream !== null &&
    typeof stream === 'object' &&
    typeof stream.pipe === 'function' &&
    stream.readable !== false &&
    typeof stream._read === 'function' &&
    typeof stream._readableState === 'object'
  )
}

export const isStreamFunctionPath = (
  options: StreamFunctionOpts
): options is StreamFunctionPath => {
  return 'path' in options && typeof options.path === 'string'
}

export const isStreamFunctionStream = (
  options: StreamFunctionOpts
): options is StreamFunctionStream => {
  return 'contents' in options && isStream(options.contents)
}

export type StreamQueueItem =
  | [
      1, // register id
      number, // reqId
      number, // contentSize
      string, // name
      string, // mimeType
      string, // fnName
      string, // extension
      any // payload
    ]
  | [
      2, // chunk
      number, // reqId,
      number, // seq,
      Uint8Array, // contents
      boolean // deflate
    ]

export type StreamQueue = StreamQueueItem[]

export type StreamResponseHandler = [
  (val?: any) => void,
  (err: Error) => void,
  (seqId: number, code: number, maxChunkSize: number) => void
]

export type StreamFunctionResponseListeners = Map<number, StreamResponseHandler>

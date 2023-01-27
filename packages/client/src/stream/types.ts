export type ReadableStream = {
  pipe: (x: any) => ReadableStream
  readable?: true
  _read: (size?: number) => void
  _readableState?: object
}

export type StreamFunctionContents = {
  contents: Buffer | ArrayBuffer | string | File | Blob
  payload?: any
  mimeType?: string
  serverKey?: string
}

export type StreamFunctionStream = {
  contents: ReadableStream
  payload?: any
  size: number
  mimeType?: string
  serverKey?: string
}

export type StreamFunctionPath = {
  path: string
  payload?: any
  mimeType?: string
  serverKey?: string
}

export type StreamFunctionOpts =
  | StreamFunctionPath
  | StreamFunctionContents
  | StreamFunctionStream

export type StreamHeaders = {
  'Content-Type': string
  Authorization: string
  Payload?: string
}

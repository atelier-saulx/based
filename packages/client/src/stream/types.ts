export type ReadableStream = {
  pipe: (x: any) => ReadableStream
  readable?: true
  _read: (size?: number) => void
  _readableState?: object
}

export type StreamFunctionContents = {
  contents: Buffer | ArrayBuffer | string | File | Blob
  opts?: any
  mimeType?: string
  server?: string
}

export type StreamFunctionStream = {
  contents: ReadableStream
  opts?: any
  size: number
  mimeType?: string
  server?: string
}

export type StreamFunctionPath = {
  path: string
  mimeType?: string
  opts?: any
  server?: string
}

export type StreamFunctionOpts =
  | StreamFunctionPath
  | StreamFunctionContents
  | StreamFunctionStream

export type ReadableStream = {
  pipe: (x: any) => ReadableStream
  // readable?: true
  // _readableState?: object
}

export type ProgressListener = (progress: number, files: number) => void

export type StreamFunctionContents<
  F = Buffer | ArrayBuffer | string | File | Blob
> = {
  contents: F
  payload?: any
  mimeType?: string
  fileName?: string
  serverKey?: string
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

export type StreamHeaders = {
  'Content-Extension'?: string
  'Content-Length'?: string
  'Content-Type': string
  'Content-Name'?: string
  Authorization: string
}

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

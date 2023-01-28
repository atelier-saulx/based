export type ReadableStream = {
  pipe: (x: any) => ReadableStream
  // readable?: true
  // _readableState?: object
}

export type StreamFunctionContents<
  F = Buffer | ArrayBuffer | string | File | Blob
> = {
  contents: F
  payload?: any
  mimeType?: string
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
  contentLength: number
  mimeType?: string
  serverKey?: string
  extension?: string
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
  'Content-Extension'?: string
  'Content-Length'?: string
  'Content-Type': string
  Authorization: string
  Payload?: string
}

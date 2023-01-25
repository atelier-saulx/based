export type ReadableStream = {
  pipe: (x: any) => ReadableStream
  readable?: true
  _read: (size?: number) => void
  _readableState?: object
}

export type FileUploadContents = {
  contents: Buffer | ArrayBuffer | string | File | Blob
  opts?: any
  mimeType?: string
  server?: string
}

export type FileUploadStream = {
  contents: ReadableStream
  opts?: any
  size: number
  mimeType?: string
  server?: string
}

export type FileUploadPath = {
  path: string
  mimeType?: string
  opts?: any
  server?: string
}

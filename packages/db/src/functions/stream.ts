import { Duplex, Readable } from 'node:stream'
import util from 'node:util'

export class BasedDataStream extends Duplex {
  public size: number = 0
  public paused: boolean = false
  public receivedBytes: number = 0
  public progressTimer?: NodeJS.Timeout

  constructor(size: number) {
    super()
    this.size = size

    this.on('pause', () => {
      this.paused = true
    })

    this.on('resume', () => {
      this.paused = false
    })

    this.emit('progress', 0)
  }

  override _read() {}

  override _write(chunk, encoding, callback) {
    this.receivedBytes += chunk.byteLength
    if (this.size && this.size > 20000) {
      if (!this.progressTimer) {
        this.progressTimer = setTimeout(() => {
          const progress = this.receivedBytes / this.size
          this.emit('progress', progress)
          this.progressTimer = undefined
        }, 200)
      }
    }
    this.push(Buffer.from(chunk, encoding))
    callback()
  }

  override _final() {
    if (!this.size) {
      this.size = this.receivedBytes
    }
    this.receivedBytes = this.size
    if (this.progressTimer) {
      clearTimeout(this.progressTimer)
      this.progressTimer = undefined
    }
    this.emit('progress', 1)
    this.push(null)
  }

  [util.inspect.custom]() {
    if (this.size) {
      const rb =
        this.receivedBytes < 1000
          ? Math.round(this.receivedBytes / 1024) + 'kb'
          : Math.round(this.receivedBytes / 1024 / 1024) + 'mb'

      return `[BasedStream ${~~(
        (this.receivedBytes / this.size) *
        100
      )}% ${rb}]`
    } else {
      return `[BasedStream]`
    }
  }
}

// maybe make a type pkg
export type StreamFunctionContents<F = Buffer | ArrayBuffer | string> = {
  contents: F
  payload?: any
  mimeType?: string
  fileName?: string
}

export type StreamFunctionStream =
  | {
      contents: Readable | Duplex
      payload?: any
      size: number
      mimeType?: string
      fileName?: string
      extension?: string
    }
  | {
      contents: BasedDataStream
      payload?: any
      size?: number
      mimeType?: string
      fileName?: string
      extension?: string
    }

export type StreamFunctionOpts = StreamFunctionContents | StreamFunctionStream

export const isStreamFunctionOpts = (
  opts: StreamFunctionContents | StreamFunctionStream,
): opts is StreamFunctionStream => {
  return opts.contents instanceof Duplex || opts.contents instanceof Readable
}

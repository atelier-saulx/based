import { Duplex } from 'stream'
import util from 'node:util'

// prob want to move this to based functions
export class BasedDataStream extends Duplex {
  public size: number = 0
  public receivedBytes: number = 0
  public progessTimer: NodeJS.Timeout

  constructor(size: number) {
    super()
    this.size = size
    this.emit('progress', 0)
  }

  _read() {}

  _write(chunk, encoding, callback) {
    this.receivedBytes += chunk.byteLength
    if (this.size && this.size > 20000) {
      if (!this.progessTimer) {
        this.progessTimer = setTimeout(() => {
          const progress = this.receivedBytes / this.size
          this.emit('progress', progress)
          this.progessTimer = null
        }, 200)
      }
    }
    this.push(Buffer.from(chunk, encoding))
    callback()
  }

  _final() {
    if (!this.size) {
      this.size = this.receivedBytes
    }
    this.receivedBytes = this.size
    if (this.progessTimer) {
      clearTimeout(this.progessTimer)
      this.progessTimer = null
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

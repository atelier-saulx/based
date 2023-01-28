import { Duplex } from 'stream'
import util from 'node:util'

// copy / ;/ or shall we just run stream functions on the main thread

// how to send to worker...
export class DataStream extends Duplex {
  _read() {}

  // writableHighWaterMark:
  _write(chunk, encoding, callback) {
    this.push(Buffer.from(chunk, encoding))
    callback()
  }

  _final() {
    this.push(null)
  }

  [util.inspect.custom]() {
    return 'BasedStream'
  }
}

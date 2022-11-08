import { Duplex } from 'stream'

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
}

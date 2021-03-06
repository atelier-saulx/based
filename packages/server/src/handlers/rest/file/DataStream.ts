import { Duplex } from 'stream'

export class DataStream extends Duplex {
  _read() {}

  // writableHighWaterMark:
  _write(chunk, encoding, callback) {
    this.push(Buffer.from(chunk))
    callback()
  }

  _final() {
    this.push(null)
  }
}

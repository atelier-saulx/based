import Emitter from './Emitter'
import connect from './socket'
import { Connection } from './socket/types'

type BasedDbClientOpts = { port: number; host: string }

export class BasedDbClient extends Emitter {
  public connected: boolean = false
  public connection: Connection

  public opts: BasedDbClientOpts

  constructor() {
    super()
    console.info('make a new db client...')
  }

  onData(data: Buffer) {
    console.log('luzzzl', data)
  }

  onReconnect() {
    this.connected = true
    this.emit('reconnect', true)
  }

  onOpen() {
    this.connected = true
    this.emit('connect', true)
  }

  onClose() {
    this.connected = false
    this.emit('disconnect', true)
  }

  public connect(opts: { port: number; host: string }) {
    if (
      this.opts &&
      (this.opts.port !== opts.port || this.opts.host !== opts.host)
    ) {
      this.disconnect()
    }
    this.opts = opts
    this.connection = connect(this, opts.port, opts.host)
  }

  disconnect() {
    if (this.connection) {
      this.connection.disconnected = true
      if (this.connection.socket) {
        this.connection.socket.destroy()
      }
      if (this.connected) {
        this.onClose()
      }
      delete this.connection
    }
    this.connected = false
  }
}

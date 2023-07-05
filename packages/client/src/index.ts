import Emitter from './Emitter'
import { createConnection } from './connection'

export class BasedDbClient extends Emitter {
  public connection: {
    socket: any
  }

  constructor({ port, host }: { port: number; host: string }) {
    super()
    console.info('make a new db client...')
    this.connection = { socket: createConnection({ port, host }) }
  }
}

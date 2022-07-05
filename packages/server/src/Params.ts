import { BasedServer } from './'
import BasedServerClient from './BasedServerClient'
import { Client } from './Client'
import { Readable } from 'stream'

export class Params {
  constructor(
    server: BasedServer,
    payload?: any,
    user?: Client,
    callStack?: string[],
    update?: (value: any, checksum?: number) => void,
    name?: string,
    type?: string,
    useGlobalBased: boolean = false,
    stream: Readable = null
  ) {
    this.server = server
    if (callStack) {
      this.callStack = callStack
    }
    if (user) {
      this.user = user
    }
    if (stream) {
      this.fileStream = stream
    }
    if (update) {
      this.update = update
    }
    if (name) {
      this.name = name
    }
    if (type) {
      this.type = type
    }
    this.payload = payload

    if (useGlobalBased) {
      this.useGlobalBased = true
    }
  }

  private useGlobalBased?: boolean

  public type?: string

  public name?: string

  public update: (value: any, checksum?: number) => void = (
    value: any,
    checksum?: number
  ) => {
    console.warn(
      'cannot use update on a non-observable function',
      value,
      checksum
    )
  }

  public callStack: string[] // this can be re-used

  public user: Client

  public payload?: any

  public fileStream?: Readable

  private _based: BasedServerClient

  public server: BasedServer

  get based(): BasedServerClient {
    if (this.useGlobalBased) {
      return this.server.based
    } else {
      return this._based || (this._based = new BasedServerClient(this))
    }
  }
}

Params.prototype.callStack = []

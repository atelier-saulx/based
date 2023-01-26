import {
  ObservableUpdateFunction,
  ObserveErrorListener,
} from '../../observable'
import { observe } from '../observe'
import { get } from '../get'
import { Context, InternalSessionClient } from '../../context'
import { BasedQuery as BasedQueryAbstract } from '@based/functions'

export class BasedQuery extends BasedQueryAbstract {
  public query: any
  public name: string
  public ctx: Context<InternalSessionClient>

  constructor(ctx: Context<InternalSessionClient>, name: string, payload: any) {
    super()
    this.ctx = ctx
    this.query = payload
    this.name = name
  }

  subscribe(
    onData: ObservableUpdateFunction,
    onError?: ObserveErrorListener
  ): () => void {
    return observe(
      this.ctx.session.client.server,
      this.name,
      this.ctx,
      this.query,
      onData,
      onError
    )
  }

  async getWhen(
    condition: (data: any, checksum: number) => boolean
  ): Promise<any> {
    return new Promise((resolve) => {
      const close = this.subscribe((data, checksum) => {
        if (condition(data, checksum)) {
          resolve(data)
          close()
        }
      })
    })
  }

  async get(): Promise<any> {
    return get(this.ctx.session.client.server, this.name, this.ctx, this.query)
  }
}

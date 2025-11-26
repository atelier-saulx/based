import {
  BasedChannel as BasedChannelAbstract,
  ChannelMessageFunction,
  Context,
  InternalSessionClient,
} from '../../../functions/index.js'
import { publish } from '../publish.js'
import { subscribeChannel } from '../channelSubscribe.js'
import { genObserveId } from '../../../protocol/index.js'

export class BasedChannel extends BasedChannelAbstract {
  public payload: any
  public name: string
  public id: number
  public ctx: Context<InternalSessionClient>

  constructor(ctx: Context<InternalSessionClient>, name: string, payload: any) {
    super()
    this.ctx = ctx
    this.payload = payload
    this.id = genObserveId(name, payload)
    this.name = name
  }

  subscribe(
    onMessage: ChannelMessageFunction,
    onError?: (err: any) => void,
  ): () => void {
    return subscribeChannel(
      this.ctx.session!.client.server,
      this.name,
      this.id,
      this.payload,
      (msg, err) => {
        if (err) {
          if (onError) {
            onError(err)
          }
          return
        }
        onMessage(msg)
      },
    )
  }

  publish(message: any, ctx: Context = this.ctx): void {
    publish(
      this.ctx.session!.client.server,
      this.name,
      ctx,
      this.id,
      this.payload,
      message,
    )
  }
}

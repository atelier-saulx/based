import {
  BasedChannel as BasedChannelAbstract,
  ChannelMessageFunction,
  Context,
  InternalSessionClient,
} from '@based/functions'
import { genObservableId } from '../../observable'
import { publish } from '../publish'
import { subscribeChannel } from '../channelSubscribe'

// add generics...
export class BasedChannel extends BasedChannelAbstract {
  public payload: any
  public name: string
  public id: number
  public ctx: Context<InternalSessionClient>

  constructor(ctx: Context<InternalSessionClient>, name: string, payload: any) {
    super()
    this.ctx = ctx
    this.payload = payload
    this.id = genObservableId(name, payload)
    this.name = name
  }

  subscribe(
    onMessage: ChannelMessageFunction,
    onError?: (err: any) => void
  ): () => void {
    return subscribeChannel(
      this.ctx.session.client.server,
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
      }
    )
  }

  publish(message: any, ctx: Context = this.ctx): void {
    publish(
      this.ctx.session.client.server,
      this.name,
      ctx,
      this.id,
      this.payload,
      message
    )
  }
}

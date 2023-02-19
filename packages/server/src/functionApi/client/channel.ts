import {
  BasedChannel as BasedChannelAbstract,
  ChannelMessageFunction,
  Context,
  InternalSessionClient,
} from '@based/functions'

// add generics...
export class BasedChannel extends BasedChannelAbstract {
  public payload: any
  public name: string
  public ctx: Context<InternalSessionClient>

  constructor(ctx: Context<InternalSessionClient>, name: string, payload: any) {
    super()
    this.ctx = ctx
    this.payload = payload
    this.name = name
  }

  subscribe(onMessage: ChannelMessageFunction): () => void {
    console.log(onMessage)
    return () => {}
  }

  publish(message: any): void {
    console.log(message)
  }
}

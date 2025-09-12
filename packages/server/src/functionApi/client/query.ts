import {
  ObservableUpdateFunction,
  ObserveErrorListener,
} from '../../query/index.js'
import { observe } from '../observe.js'
import { get } from '../get.js'
import {
  BasedQuery as BasedQueryAbstract,
  Context,
  InternalSessionClient,
} from '@based/functions'

export class BasedQuery extends BasedQueryAbstract {
  public query: any
  public name: string
  public ctx: Context<InternalSessionClient>
  public attachedCtx: { [key: string]: any }

  constructor(
    ctx: Context<InternalSessionClient>,
    name: string,
    payload: any,
    attachedCtx: { [key: string]: any },
  ) {
    super()
    this.ctx = ctx
    this.query = payload
    this.name = name
    this.attachedCtx = attachedCtx
  }

  subscribe(
    onData: ObservableUpdateFunction,
    onError?: ObserveErrorListener,
  ): () => void {
    // @ts-ignore
    if (!onData.safe) {
      const unsafeOnData = onData
      onData = (data, checksum, err, cache, diff, fromCehcksum, isDeflate) => {
        try {
          const x = unsafeOnData(
            data,
            checksum,
            err,
            cache,
            diff,
            fromCehcksum,
            isDeflate,
          )
          // @ts-ignore
          if (x != null && typeof x === 'object' && 'catch' in x) {
            // @ts-ignore
            return x.catch((err) => {
              if (onError) {
                onError(err)
              } else {
                console.error(
                  `[Query:${this.name}] Async Error in observable function onData handler \n ${err.message}`,
                )
              }
            })
          } else {
            return x
          }
        } catch (err) {
          if (onError) {
            onError(err)
          } else {
            console.error(
              `[Query:${this.name}] Error in observable function onData handler \n ${err.message}`,
            )
          }
        }
      }
      // @ts-ignore
      onData.safe = true
    }

    return observe(
      this.ctx.session.client.server,
      this.name,
      this.ctx,
      this.query,
      onData,
      onError,
      this.attachedCtx,
    )
  }

  async getWhen(
    condition: (data: any, checksum: number) => boolean,
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

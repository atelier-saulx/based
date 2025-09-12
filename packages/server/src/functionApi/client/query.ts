import {
  AttachedCtx,
  ObservableUpdateFunction,
  ObserveErrorListener,
} from '../../query/index.js'
import { observe } from '../observe.js'
import { get } from '../get.js'
import {
  BasedQuery as BasedQueryAbstract,
  BasedRoute,
  Context,
  InternalSessionClient,
} from '@based/functions'
import { attachCtx, attachCtxInternal } from '../../query/attachCtx.js'
import { genObserveId } from '@based/protocol/client-server'
import { verifyRoute } from '../../verifyRoute.js'
import { BasedServer } from '../../server.js'

export class BasedQuery extends BasedQueryAbstract {
  public payload: any
  public name: string
  public ctx: Context<InternalSessionClient>
  public attachedCtx: AttachedCtx
  public id: number
  public route: BasedRoute<'query'>

  constructor(
    ctx: Context<InternalSessionClient>,
    name: string,
    payload: any,
    attachedCtx?: { [key: string]: any } | Context,
  ) {
    super()

    const server = ctx.session.client.server

    this.id = genObserveId(name, payload)
    this.ctx = ctx
    this.payload = payload
    this.name = name

    this.route = verifyRoute(
      server,
      ctx,
      'query',
      server.functions.route(name),
      name,
      this.id,
    )

    if (!this.route) {
      throw new Error(`Query ${this.route.name} does not exist`)
    }
    if (attachedCtx && this.route.ctx) {
      this.attachedCtx =
        'session' in attachedCtx
          ? attachCtx(server, this.route.ctx, attachedCtx, this.id)
          : attachCtxInternal(this.route.ctx, attachedCtx, this.id)
    }
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

    return observe(this, onData, onError)
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
    return get(this)
  }
}

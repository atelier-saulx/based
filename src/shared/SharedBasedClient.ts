import { AuthState, BasedClient, BasedOpts } from '@based/client'
import { hashObjectIgnoreKeyOrderNest } from '@saulx/hash'
import { clearTimeout } from 'node:timers'
import { AppContext } from './AppContext.js'

const store: Record<
  string,
  {
    users: number
    client: SharedBasedClient
  }
> = {}

class SharedBasedClient extends BasedClient {
  private context: AppContext

  public constructor(context: AppContext, opts?: BasedOpts) {
    super(opts)
    this.context = context
  }

  override async setAuthState(args: AuthState) {
    const timeout = setTimeout(() => {
      const { file } = this.context.get('basedProject')

      this.context.print
        .stop()
        .fail(this.context.i18n('errors.499', file), true)
    }, 5e3)

    let authState: AuthState

    try {
      await super.setAuthState(args)

      clearTimeout(timeout)

      return authState
    } catch (error) {
      clearTimeout(timeout)

      throw String(error).includes('token expired') ? 401 : error
    }
  }

  override async destroy() {
    const key = String(hashObjectIgnoreKeyOrderNest(this.opts))
    if (key in store) {
      store[key].users--

      if (store[key].users === 0) {
        delete store[key]
        return super.destroy()
      }
    }
  }
}

export const getBasedClient = (
  context: AppContext,
  opts: BasedOpts,
): BasedClient => {
  const key = String(hashObjectIgnoreKeyOrderNest(opts))
  store[key] ??= {
    users: 0,
    client: new SharedBasedClient(context, opts),
  }

  store[key].users++

  return store[key].client
}

import { AuthState, BasedClient, BasedOpts } from '@based/client'
import { hashObjectIgnoreKeyOrderNest } from '@saulx/hash'
import { clearTimeout } from 'node:timers'
import AppContext from './AppContext.js'

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
    const [emoji, target] =
      this.opts.org === 'saulx' && this.opts.project === 'based-cloud'
        ? ['📡', 'Based Cloud']
        : this.opts.optionalKey
          ? ['🌎', 'the environment manager']
          : ['🪐', 'the environment']

    this.context.print.loading(`Connecting to ${target}`)

    const timeout = setTimeout(() => {
      this.context.print.fail(
        `Could not connect. Check your '<b>based.json</b>' file or your arguments.`,
      )
    }, 5e3)

    const authState = await super.setAuthState(args)

    clearTimeout(timeout)
    this.context.print.stop().success(`${emoji} Connected to ${target}.`)

    return authState
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

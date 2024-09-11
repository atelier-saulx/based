import { AuthState, BasedClient, BasedOpts } from '@based/client'
import { hashObjectIgnoreKeyOrderNest } from '@saulx/hash'
import { spinner } from './spinner.js'
import pc from 'picocolors'
import { clearTimeout } from 'node:timers'

const store: Record<
  string,
  {
    users: number
    client: SharedBasedClient
  }
> = {}

class SharedBasedClient extends BasedClient {
  override async setAuthState(args: AuthState) {
    const [emoji, target] =
      this.opts.org === 'saulx' && this.opts.project === 'based-cloud'
        ? ['📡', 'Based Cloud']
        : ['🪐', 'the environment']

    spinner.text = `Connecting to ${target}`
    spinner.start()

    const timeout = setTimeout(() => {
      spinner.fail(pc.red('Could not connect.'))
      spinner.fail(pc.red('Check your based.json file or your arguments.'))
      process.exit(1)
    }, 5e3)

    const authState = await super.setAuthState(args)

    clearTimeout(timeout)
    spinner.succeed(`${emoji} Connected to ${target}.`)

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

export const getBasedClient = (opts: BasedOpts): BasedClient => {
  const key = String(hashObjectIgnoreKeyOrderNest(opts))
  store[key] ??= {
    users: 0,
    client: new SharedBasedClient(opts),
  }

  store[key].users++

  return store[key].client
}

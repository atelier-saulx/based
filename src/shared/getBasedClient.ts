import { BasedClient, BasedOpts } from '@based/client'
import { hashObjectIgnoreKeyOrderNest } from '@saulx/hash'
import { spinner } from './spinner.js'

const store: Record<
  string,
  {
    users: number
    client: SharedBasedClient
  }
> = {}

class SharedBasedClient extends BasedClient {
  //   override async call(name, ...args) {
  //     const spinner = ora(name).start()
  //     const res = await super.call(name, ...args)
  //     spinner.succeed()
  //     return res
  //   }

  override async connect(...args) {
    await super.connect(...args)
    const [emoji, target] =
      this.opts.org === 'saulx' && this.opts.project === 'based-cloud'
        ? ['📡', 'based cloud']
        : ['🪐', 'environment']

    const timer = setTimeout(async () => {
      spinner.text = `connecting ${target}`
      spinner.start()
      await this.once('connect')
      spinner.stop()
    }, 1e3)

    await this.once('connect')

    clearTimeout(timer)

    console.info(`${emoji} connected ${target}`)
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

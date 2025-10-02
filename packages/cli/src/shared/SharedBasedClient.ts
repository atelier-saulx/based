import { clearTimeout } from 'node:timers'
import {
  type ClientAuthState as AuthState,
  BasedClient,
  type BasedOpts,
} from '@based/client'
import { hashObjectIgnoreKeyOrderNest } from '@based/hash'
import { AppContext } from '../context/AppContext.js'
import { CONNECTION_TIMEOUT } from './constants.js'

export class SharedBasedClient extends BasedClient {
  private static instance: Record<
    string,
    { users: number; client: SharedBasedClient }
  >

  public static getInstance(opts: BasedOpts): SharedBasedClient {
    const key = String(hashObjectIgnoreKeyOrderNest(opts))

    if (!SharedBasedClient.instance?.[key]) {
      SharedBasedClient.instance = {
        ...SharedBasedClient.instance,
        [key]: {
          users: 0,
          client: new SharedBasedClient(opts),
        },
      }

      SharedBasedClient.instance[key].users++
    }

    return SharedBasedClient.instance?.[key].client
  }

  override async setAuthState(args: AuthState) {
    const context: AppContext = AppContext.getInstance()
    const timeout = setTimeout(() => {
      const { file } = context.get('basedProject')

      context.spinner.stop(context.i18n('errors.499', file))
    }, CONNECTION_TIMEOUT)

    let authState: AuthState

    try {
      await super.setAuthState(args)

      clearTimeout(timeout)

      return authState
    } catch (error) {
      clearTimeout(timeout)

      return Promise.reject({
        token: '',
        userId: '',
        refreshToken: '',
        error: String(error).includes('token expired')
          ? context.i18n('errors.402')
          : error,
        persistent: false,
        type: '',
      })
    }
  }

  override async destroy() {
    const key = String(hashObjectIgnoreKeyOrderNest(this.opts))

    if (key in SharedBasedClient.instance) {
      SharedBasedClient.instance[key].users--

      if (SharedBasedClient.instance[key].users === 0) {
        delete SharedBasedClient.instance[key]
        return super.destroy()
      }
    }
  }
}

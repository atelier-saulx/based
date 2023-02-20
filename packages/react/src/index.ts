import {
  useContext,
  createContext,
  createElement,
  ReactNode,
  useState,
  useEffect,
} from 'react'
import { BasedClient, AuthState } from '@based/client'

const Ctx = createContext<BasedClient>()

export const Provider = ({
  client,
  children,
}: {
  client: BasedClient
  children: ReactNode
}) => {
  return createElement(Ctx.Provider, { value: client }, children)
}

export const useAuthState = (): AuthState => {
  const client: BasedClient = useContext(Ctx)
  const [state, setState] = useState<AuthState>(client.authState)

  useEffect(() => {
    const listener = (authState) => {
      setState(authState)
    }
    client.on('authstate-change', listener)
    return () => client.off('authstate-change', listener)
  }, [])

  return state
}

export const useQuery = (
  name?: string,
  payload?: any,
  opts?: {
    persistent: boolean
  }
): {
  loading: boolean
  data?: any
  checksum?: number
} => {
  const client: BasedClient = useContext(Ctx)

  if (name) {
    const q = client.query(name, payload, opts)
    const { id, cache } = q
    const [checksum, update] = useState(cache?.checksum)

    useEffect(() => {
      const unsubscribe = q.subscribe((_, checksum) => {
        update(checksum)
      })

      return () => {
        unsubscribe()
      }
    }, [id])

    return cache
      ? { loading: false, data: cache.value, checksum }
      : { loading: true }
  }

  // stubs
  useEffect(() => {}, [null])
  useState()

  return { loading: true, data: null }
}

export const useClient = (): BasedClient => {
  const client = useContext(Ctx)
  return client
}

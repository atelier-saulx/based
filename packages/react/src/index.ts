import {
  useContext,
  createContext,
  createElement,
  useState,
  useEffect,
  FC,
  ReactNode,
} from 'react'
import { BasedClient, AuthState } from '@based/client'

const Ctx = createContext<BasedClient>(null)

export const Provider: FC<{
  client: BasedClient
  children: ReactNode
}> = ({ client, children }) => {
  return createElement(Ctx.Provider, { value: client }, children)
}

export const useAuthState = (): AuthState => {
  const client: BasedClient = useContext(Ctx)
  const [state, setState] = useState<AuthState>(client?.authState || {})

  useEffect(() => {
    if (client) {
      setState(client.authState)
      const listener = (authState) => {
        setState(authState)
      }
      client.on('authstate-change', listener)
      return () => client.off('authstate-change', listener)
    }
  }, [client])

  return state
}

export const useConnected = () => {
  const client: BasedClient = useContext(Ctx)
  const [connected, setConnected] = useState(client.connected)

  useEffect(() => {
    if (client) {
      setConnected(client.connected)
      const listener = () => {
        setConnected(client.connected)
      }
      client.on('disconnect', listener)
      client.on('reconnect', listener)
      client.on('connect', listener)
      return () => {
        client.off('disconnect', listener)
        client.off('reconnect', listener)
        client.off('connect', listener)
      }
    }
  }, [client])

  return { connected }
}

export const useQuery = <T = any>(
  name?: string,
  payload?: any,
  opts?: {
    persistent: boolean
  }
): {
  loading: boolean
  data?: T
  checksum?: number
} => {
  const client: BasedClient = useContext(Ctx)

  if (client && name) {
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
  useState()
  useEffect(() => {}, [null])

  return { loading: true }
}

export const useClient = (): BasedClient => {
  const client = useContext(Ctx)
  return client
}

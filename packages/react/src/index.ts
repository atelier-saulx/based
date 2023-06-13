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
import { BasedError } from '@based/client'

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

const useLoadingListeners: Set<Function> = new Set()
const hooksLoading: Set<number> = new Set()

export const useLoading = () => {
  const [isLoading, setLoading] = useState(hooksLoading.size > 0)
  useEffect(() => {
    useLoadingListeners.add(setLoading)
    return () => {
      useLoadingListeners.delete(setLoading)
    }
  }, [])
  return isLoading
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
  error?: BasedError
  checksum?: number
} => {
  const client: BasedClient = useContext(Ctx)

  if (client && name) {
    const q = client.query(name, payload, opts)
    const { id, cache } = q
    const [checksumOrError, update] = useState<number | BasedError>(
      cache?.checksum
    )

    useEffect(() => {
      const unsubscribe = q.subscribe(
        (_, checksum) => {
          update(checksum)
        },
        (err) => {
          update(err)
        }
      )

      return () => {
        unsubscribe()
      }
    }, [id])

    if (checksumOrError) {
      const isLoading = hooksLoading.size > 0
      if (hooksLoading.delete(id)) {
        if (!(hooksLoading.size > 0) && !isLoading) {
          useLoadingListeners.forEach((fn) => {
            fn(false)
          })
        }
      }

      if (typeof checksumOrError === 'number') {
        return { loading: false, data: cache.value, checksum: checksumOrError }
      }
      return { loading: false, error: checksumOrError }
    }

    const isLoading = hooksLoading.size > 0
    if (hooksLoading.add(id)) {
      if (!isLoading) {
        useLoadingListeners.forEach((fn) => {
          fn(true)
        })
      }
    }

    return { loading: true }
  }

  useState()
  useEffect(() => {}, [null])

  return { loading: true }
}

export const useClient = (): BasedClient => {
  return useContext(Ctx)
}

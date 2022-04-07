import React, {
  createContext,
  FunctionComponent,
  ReactNode,
  useContext,
  useEffect,
  useReducer,
} from 'react'

import based, { Based, BasedOpts } from '@based/client'

import { genOptsId } from './genOptsId'

export type CreateClient = (
  selector: string | (BasedOpts & { key?: string })
) => Based

const newClientListeners: Set<() => void> = new Set()

interface BasedContextType {
  clients: { [key: string]: Based }
  createClient?: CreateClient
  removeClient: (
    selector: string | (BasedOpts & { key?: string }) | Based
  ) => void
}

export const BasedContext = createContext<BasedContextType>({
  clients: {},
  // eslint-disable-next-line
  removeClient: (...args: any) => {},
})

export const defaultCreateClient: CreateClient = (selector) => {
  if (typeof selector === 'object') {
    if (
      process.env.CLUSTER &&
      process.env.CLUSTER.startsWith('local') &&
      !selector.cluster
    ) {
      selector.cluster = process.env.CLUSTER
    }
    return based(selector)
  } else {
    // default
    console.error('Cannot create client from ' + selector)
  }
}

export const Provider: FunctionComponent<{
  client?: Based
  clients?: { [key: string]: Based }
  children: ReactNode
  createClient?: CreateClient
}> = ({ client, children, clients, createClient }) => {
  if (!clients && client) {
    clients = {
      default: client,
    }
  } else if (clients && client) {
    clients.default = client
  }

  const ctx = React.createElement(
    BasedContext.Provider,
    {
      value: {
        clients,
        createClient: createClient || defaultCreateClient,
        removeClient: (selector) => {
          if (selector instanceof Based) {
            for (const cl in clients) {
              if (clients[cl] === selector) {
                selector = cl
                break
              }
            }
            if (typeof selector !== 'string') {
              console.error('Cannot find client to remove from ctx', selector)
              return
            }
          } else if (typeof selector !== 'string') {
            selector = genOptsId(selector)
          }
          // @ts-ignore
          if (clients[selector]) {
            // @ts-ignore
            clients[selector].disconnect()
            // @ts-ignore
            delete clients[selector]
            newClientListeners.forEach((fn) => fn())
          }
        },
      },
    },
    children
  )

  return ctx
}

export const useBasedContext = () => {
  return useContext(BasedContext)
}

function forceUpdate(state: number) {
  return state + 1
}

export const useClients = (): Based[] => {
  const ctx = useBasedContext()
  const [, update] = useReducer(forceUpdate, 0)

  useEffect(() => {
    let timer
    const fn = () => {
      timer = setTimeout(update, 0)
    }
    newClientListeners.add(fn)
    return () => {
      newClientListeners.delete(fn)
      clearTimeout(timer)
    }
  }, [])

  return Object.values(ctx.clients)
}

export const useClient = (
  selector: string | (BasedOpts & { key?: string }) = 'default'
) => {
  const basedCtx = useContext(BasedContext)

  if (typeof selector === 'object') {
    if (!(selector.env && selector.project && selector.org)) {
      return
    }
  }

  let key: string

  if (typeof selector === 'string') {
    key = selector
  } else {
    key = selector.key || genOptsId(selector)
  }

  let client: Based = basedCtx.clients[key]

  if (!client && basedCtx.createClient) {
    client = basedCtx.createClient(selector)

    if (client) {
      basedCtx.clients[key] = client
      newClientListeners.forEach((fn) => fn())
    }
  }

  return client
}

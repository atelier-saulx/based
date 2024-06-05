import React from 'react'
import { createContext, FC } from 'react'
import type { Context } from 'react'
import { BasedClient } from '@based/client'

/**
 * The props from the `BasedProvider` component.
 */
type BasedProviderProps = {
  /** All the connection information that identifies you in the `Based` cloud. **/
  client: BasedClient
  /** Any component that you want to inject the `BasedClient` context. **/
  children: JSX.Element | JSX.Element[]
}

/**
 * The helper that provide the context to be used across the app.
 */
const BasedContext: Context<BasedClient> = createContext<BasedClient>(null)

/**
 * The component that wrap and inject the context to all children components
 *
 * @example
 * ```
 * <BasedProvider client={client}>
 *   // your app goes here
 * </BasedProvider>
 * ```
 */
const BasedProvider: FC<BasedProviderProps> = ({ client, children }) => {
  return (
    <BasedContext.Provider value={client}>
      <div className="based-io">{children}</div>
    </BasedContext.Provider>
  )
}

/**
 * Alias to `BasedProvider`.
 *
 * @deprecated `BasedProvider` is still working, but we're moving to use `BasedProvider` instead.
 */
const Provider = BasedProvider

export { Provider, BasedProvider, BasedContext }

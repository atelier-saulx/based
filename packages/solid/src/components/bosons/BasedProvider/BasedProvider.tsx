import { createContext, JSX } from 'solid-js'
import type { Component, Context as SolidContext } from 'solid-js'
import { BasedClient } from '@based/client'

/**
 * The props from the `BasedProvider` component
 */
type BasedProviderProps = {
  /** All the connection information that identifies you in the `Based` cloud. **/
  client: BasedClient
  /** Any component that you want to inject the `BasedClient` context. **/
  children: JSX.Element | JSX.Element[]
}

const BasedContext: SolidContext<BasedClient> = createContext<BasedClient>()

const BasedProvider: Component<BasedProviderProps> = (
  props: BasedProviderProps,
) => {
  return (
    <BasedContext.Provider value={props.client}>
      {props.children}
    </BasedContext.Provider>
  )
}

/**
 * Alias to `BasedProvider`.
 *
 * @deprecated `Provider` is still working, but we're moving to use `BasedProvider` instead.
 */
const Provider = BasedProvider

export { Provider, BasedProvider, BasedContext }

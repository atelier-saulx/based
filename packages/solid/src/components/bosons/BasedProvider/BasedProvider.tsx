import { createContext, JSX } from 'solid-js'
import type { Component, Context as SolidContext } from 'solid-js'
import { BasedClient } from '@based/client'

/**
 * The props from the `BasedProvider` component.
 */
type BasedProviderProps = {
  /** All the connection information that identifies you in the `Based` cloud. */
  client: BasedClient
  /** Any component that you want to inject the `BasedClient` context. */
  children: JSX.Element | JSX.Element[]
}

/**
 * The helper that provide the context to be used across the app.
 */
const BasedContext: SolidContext<BasedClient> = createContext<BasedClient>()

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
const BasedProvider: Component<BasedProviderProps> = (
  props: BasedProviderProps,
) => (
  <BasedContext.Provider value={props.client}>
    <div class="based-io">{props.children}</div>
  </BasedContext.Provider>
)

/**
 * Alias to `BasedProvider`.
 *
 * @deprecated `BasedProvider` is still working, but we're moving to use `BasedProvider` instead.
 */
const Provider = BasedProvider

export { Provider, BasedProvider, BasedContext }

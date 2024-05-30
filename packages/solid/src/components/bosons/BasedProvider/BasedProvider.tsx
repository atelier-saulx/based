import { createContext, JSX } from 'solid-js'
import type { Component, Context as SolidContext } from 'solid-js'
import { BasedClient } from '@based/client'

/**
 * The props from the `BasedProvider` component
 */
type BasedProviderProps = {
    /** All the connection information that identifies you in the `Based` cloud. **/
    client: BasedClient,
    /** Any component that you want to inject the `BasedClient` context. **/
    children: JSX.Element | JSX.Element[]
}

export const BasedContext: SolidContext<BasedClient> = createContext<BasedClient>();

const BasedProvider: Component<BasedProviderProps> = (props: BasedProviderProps) => {
    return (
        <BasedContext.Provider value={props.client}>
            {props.children}
        </BasedContext.Provider>
    )
}

/**
 * Alias to `BasedProvider`.
 */
const Provider = BasedProvider

export { Provider }
export default BasedProvider;
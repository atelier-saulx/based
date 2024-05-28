import { createContext, JSX } from 'solid-js'
import type { Component, Context as SolidContext } from 'solid-js'
import { BasedClient } from '@based/client'

type BasedProviderProps = {
    client: BasedClient,
    children: JSX.Element | JSX.Element[]
}

export const BasedContext: SolidContext<BasedClient> = createContext<BasedClient>();

const BasedProvider: Component<BasedProviderProps> = (props) => {
    return (
        <BasedContext.Provider value={props.client}>
            {props.children}
        </BasedContext.Provider>
    )
}

export default BasedProvider;
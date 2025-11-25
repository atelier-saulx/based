import { createElement, FC, ReactNode } from 'react'
import { Ctx } from './Ctx.js'
import type { BasedClient } from '../client/index.js'

/**
  Provider for the based client
  
  ```javascript
  <Provider client={client}><App /></Provider>
  ```
*/
export const Provider: FC<{
  client: BasedClient
  children: ReactNode
}> = ({ client, children }) => {
  return createElement(Ctx.Provider, { value: client }, children)
}

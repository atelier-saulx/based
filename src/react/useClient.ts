import { useContext } from 'react'
import { Ctx } from './Ctx.js'
import type { BasedClient } from '../client/index.js'

/**
  Returns the based client from the Provider
  
  ```javascript
  const client = useClient()
  ```
*/
export const useClient = (): BasedClient => {
  return useContext(Ctx)
}

import { useContext } from 'react'
import { BasedClient } from '@based/client'
import { Ctx } from './Ctx.js'

/**
  Returns the based client from the Provider
  
  ```javascript
  const client = useClient()
  ```
*/
export const useClient = (): BasedClient => {
  return useContext(Ctx)
}

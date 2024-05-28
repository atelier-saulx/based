import { useContext } from 'solid-js'
import { BasedClient } from '@based/client'
import { BasedContext } from "@/bosons"

const useBasedClient = (): BasedClient => {
  return useContext(BasedContext)
}

export default useBasedClient

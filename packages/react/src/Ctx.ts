import { createContext } from 'react'
import { BasedClient } from '@based/client'

export const Ctx = createContext<BasedClient>(null)

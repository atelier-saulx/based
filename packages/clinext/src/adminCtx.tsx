import { createContext } from 'react'
import { BasedClient } from '@based/client'

export const AdminCtx = createContext<BasedClient | null>(null)

import { StrictSchema } from '@based/schema'

export type DbSchema = StrictSchema & { lastId: number; hash: number }

export type SchemaChecksum = number

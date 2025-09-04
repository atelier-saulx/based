import { StrictSchema } from "./types.js"

export type DbSchema = StrictSchema & { lastId: number; hash: number }
export type SchemaChecksum = number

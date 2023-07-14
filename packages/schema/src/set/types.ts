import {
  BasedSchemaType,
  BasedSetHandlers,
  BasedSetTarget,
  BasedSchemaFields,
} from '../types'

export type Parser<K extends keyof BasedSchemaFields> = (
  path: (string | number)[],
  value: any,
  fieldSchema: BasedSchemaFields[K],
  typeSchema: BasedSchemaType,
  target: BasedSetTarget,
  handlers: BasedSetHandlers,
  noCollect?: boolean
) => Promise<void>

export type Parsers = {
  [Key in keyof BasedSchemaFields]: Parser<Key>
}

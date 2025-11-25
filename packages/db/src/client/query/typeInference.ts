type ResolvePrimitive<T> = T extends 'string' | 'text'
  ? string
  : T extends 'number' | 'uint8'
    ? number
    : T extends 'boolean'
      ? boolean
      : T extends 'timestamp'
        ? Date
        : T extends 'json'
          ? any
          : T extends 'vector'
            ? Uint8Array
            : unknown

type GetProps<T> = T extends { props: infer P } ? P : T

// Parses a single Schema Type
type ParseSchemaType<Node, AllTypes> = {
  [K in keyof GetProps<Node>]: GetProps<Node>[K] extends {
    // Handle Refs/Edges (Array)
    items: { ref: infer R }
  }
    ? R extends keyof AllTypes
      ? ParseSchemaType<AllTypes[R], AllTypes>[]
      : never
    : // Handle Refs/Edges (Single)
      GetProps<Node>[K] extends { ref: infer R }
      ? R extends keyof AllTypes
        ? ParseSchemaType<AllTypes[R], AllTypes>
        : never
      : // Handle Primitive Props
        GetProps<Node>[K] extends { type: infer T }
        ? ResolvePrimitive<T>
        : never
}

// Parses the entire Schema definition
export type ParseSchemaDef<T extends { types: any }> = {
  [K in keyof T['types']]: ParseSchemaType<T['types'][K], T['types']>
}

export type Unpacked<T> = T extends (infer U)[] ? U : T

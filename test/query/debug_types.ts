import { ResolveSchema } from '../../src/schema/index.js'
import {
  InferSchemaOutput,
  ResolveInclude,
  PickOutput,
} from '../../src/db-client/query2/types.js'

type MySchemaIn = {
  types: {
    everything: {
      s: 'string'
      n: 'number'
      nested: {
        type: 'object'
        props: {
          a: 'string'
        }
      }
    }
  }
}

type S = ResolveSchema<MySchemaIn>
type T = 'everything'
type Props = S['types'][T]['props']
type Keys = keyof Props // Should be 's' | 'n' | 'nested'

type Output = InferSchemaOutput<S, T>
type OutputKeys = keyof Output // Should include 's', 'n', 'nested', 'id'

type Inc1 = ResolveInclude<Props, 'n'> // Should be 'n'
type Inc2 = ResolveInclude<Props, 'n' | 's'> // Should be 'n' | 's'

type Pick1 = PickOutput<S, T, 'n'> // Should have 'n'
type Pick2 = PickOutput<S, T, 'n' | 's'> // Should have 'n' and 's'

// Test if intersection works
type Inter = ('n' | 's') & OutputKeys // Should be 'n' | 's'

const p1: Pick1 = {} as any
p1.n
p1.id
// @ts-expect-error
p1.s

import { Parsers } from './types'
import * as references from './references'
import * as collections from './collections'
import * as number from './number'
import * as string from './string'

import { enumParser, boolean, cardinality, json } from './rest'

const parsers: Parsers = {
  ...string,
  ...references,
  ...collections,
  ...number,
  enum: enumParser,
  boolean,
  cardinality,
  json,
}

export default parsers

export type FilterOpts = {
  lowerCase?: boolean
  fn?:
    | 'dotProduct'
    | 'manhattanDistance'
    | 'cosineSimilarity'
    | 'euclideanDistance'
  score?: number
}

export type Operator =
  | '='
  | 'includes'
  | '!includes' // includes ?
  | '<'
  | '>'
  | '!='
  | 'like'
  | '>='
  | '<='
  | '..'
  | '!..'
  | 'like'
  | 'exists'
  | '!exists'

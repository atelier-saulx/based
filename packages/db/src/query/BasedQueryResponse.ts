import { Query } from './query.js'
import { BasedIterable } from './BasedIterable.js'

export class BasedQueryResponse {
  buffer: Buffer
  query: Query
  constructor(query: Query, buffer: Buffer) {
    this.buffer = buffer
    this.query = query
  }
  get data() {
    return new BasedIterable(this.buffer, this.query)
  }
}

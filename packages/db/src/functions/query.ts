import { ObservableUpdateFunction, ObserveErrorListener } from './functions.js'

export abstract class BasedQuery<K = any> {
  abstract subscribe(
    onData: ObservableUpdateFunction<K>,
    onError?: ObserveErrorListener
  ): () => void

  abstract getWhen(
    condition: (data: K, checksum: number) => boolean
  ): Promise<any>

  abstract get(): Promise<K>
}

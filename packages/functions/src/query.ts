import { ObservableUpdateFunction, ObserveErrorListener } from './functions'

export abstract class BasedQuery {
  abstract subscribe(
    onData: ObservableUpdateFunction,
    onError?: ObserveErrorListener
  ): () => void

  abstract getWhen(
    condition: (data: any, checksum: number) => boolean
  ): Promise<any>

  abstract get(): Promise<any>
}

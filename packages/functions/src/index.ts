export abstract class BasedFunctionClient {
  abstract call(name: string, payload?: any, ctx?: any): Promise<any>

  abstract query(name: string, payload?: any): any

  abstract stream(name: string, stream?: any): Promise<any>
}

export type ObservableUpdateFunction = {
  (
    data: any,
    checksum?: number,
    diff?: any,
    fromChecksum?: number,
    isDeflate?: boolean,
    rawData?: any,
    // todo fix there errors TODO: make extra package 'errors' for client and server
    err?: any
  ): void
  __internalObs__?: true
}

export type ObserveErrorListener = (err: any) => void

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

export abstract class BasedFunctionClient {
  server: any

  abstract call(name: string, payload?: any, ctx?: any): Promise<any>

  abstract query(name: string, payload?: any): any

  abstract stream(name: string, stream?: any): Promise<any>
}

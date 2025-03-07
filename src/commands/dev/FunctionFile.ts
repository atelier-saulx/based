import type { OutputFile } from '@based/bundle'

export class FunctionFile {
  constructor({
    outputFile,
    ip,
    port,
    folder = 'static',
  }: {
    outputFile: OutputFile
    ip: string
    port: number
    folder?: string
  }) {
    this.#outputFile = outputFile
    this.#folder = folder
    this.#ip = ip
    this.#port = port
  }

  #outputFile: OutputFile
  #folder: string
  #ip: string
  #port: number

  get text() {
    return this.#outputFile?.text || ''
  }

  get url() {
    return (
      this.#outputFile?.path.replace(
        process.cwd(),
        `http://${this.#ip}:${this.#port}/${this.#folder}`,
      ) || ''
    )
  }
}

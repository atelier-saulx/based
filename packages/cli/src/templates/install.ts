import { Command } from 'commander'
import { GlobalOptions } from '../command'
import { GenericOutput } from '../types'

export type TemplatesInstallOptions = GlobalOptions & {
  name?: string
}

type TemplatesInstallOutput = GenericOutput & {
  data: {
    name: string
  }[]
}

export const templateInstallCommand = new Command('install')
  .description('Install template')
  .option('-n --name', 'Name of template to install')

import { deepMerge } from '@saulx/utils'
import { BasedServer } from '..'
import {
  BasedFunctionSpec,
  BasedObservableFunctionSpec,
  FunctionConfig,
} from '../types'
import { BasedFunction } from './function'
import { BasedObservableFunction } from './observable'

export class BasedFunctions {
  server: BasedServer

  config: FunctionConfig

  observables: {
    [key: string]: BasedObservableFunction
  } = {}

  functions: {
    [key: string]: BasedFunction
  } = {}

  constructor(server: BasedServer, config?: FunctionConfig) {
    this.server = server
    if (config) {
      this.updateConfig(config)
    }
  }

  updateConfig(config: FunctionConfig) {
    if (this.config) {
      deepMerge(this.config, config)
    } else {
      this.config = config
    }
  }

  async update(
    spec: BasedObservableFunctionSpec | BasedFunctionSpec
  ): Promise<boolean> {
    console.info(spec)
    return false
  }

  async remove(name: string): Promise<boolean> {
    console.info(name)
    return false
  }

  // run observable

  // run function
}

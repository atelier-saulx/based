export type OutputError = { message: string }

export type Config = {
  cluster?: string
  org?: string
  project?: string
  env?: string
}

export type GenericOutput = {
  data: any
  errors?: OutputError[]
}

export type ServiceInstanceData = {
  name: string
  port: number
  machine: {
    id: string
    publicIp: string
  }
  id: string
}
export type ServiceData = {
  parents: { id: string }[]
  dist: {
    name: string
    version: string
  }
  amount: number
  id: string
  args: {
    name: string
  }
  serviceInstances: ServiceInstanceData[]
}

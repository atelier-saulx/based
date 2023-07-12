import { Command } from '../types'
import { defaultEncoder } from './defaultEncoder'
import { modify } from './modify'

type CommandEncoders = Record<Command, (payload: any) => Buffer | null>

export const COMMAND_ENCODERS: CommandEncoders = {
  save: defaultEncoder([{ type: 'string' }]),
  ping: null,
  lscmd: null,
  echo: defaultEncoder([{ type: 'string' }]),
  // id, field, valueId, value
  'object.set': defaultEncoder([
    { type: 'id' },
    { type: 'string' },
    { type: 'string' },
    { type: 'string' },
  ]),
  'object.get': defaultEncoder([
    { type: 'string' }, // lang
    { type: 'id' },
    { type: 'string', vararg: true }, // ...fields
  ]),
  modify,
  'hierarchy.find': (payload) => {
    return Buffer.from('hello')
  },
}

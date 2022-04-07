import { Schema } from '@based/types'

export default function generateDelete(): string {
  return ' deleteNode(id: ID): Boolean\n'
}

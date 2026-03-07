type QueryOpts = {
  k: any
  isSingle: boolean
}

type BaseOpts = {
  k: '*'
  isSingle: false
}

type UpdateOpts<O extends Partial<QueryOpts>, Updates extends Partial<QueryOpts>> = Omit<O, keyof Updates> & Updates extends infer R ? { [K in keyof R]: R[K] } : never

type GetOpt<O extends Partial<QueryOpts>, K extends keyof QueryOpts> =
  K extends keyof O ? O[K] : BaseOpts[K]

export class Query<Opts extends Partial<QueryOpts> = {}> {
    include<K>(k: K): Query<UpdateOpts<Opts, { k: K }>> {
        return this as any;
    }
}

const q = new Query().include('id');
// Check tooltip of q here

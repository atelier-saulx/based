export type Auth =
  | {
      token: string
      renewToken?: string
      user: string
    }
  | {
      token: false
    }

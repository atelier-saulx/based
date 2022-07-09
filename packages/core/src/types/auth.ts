export type Auth =
  | {
      token: false
    }
  | {
      token: string
      renewToken?: string
      user: string
    }

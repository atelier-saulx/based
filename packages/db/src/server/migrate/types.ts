export const MigrationState = {
  AWAKE: 1,
  SLEEP: 0,
} as const
export type MigrationState =
  (typeof MigrationState)[keyof typeof MigrationState]

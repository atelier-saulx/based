import BasedProvider from './BasedProvider.vue'

export enum BasedContext {
  CLIENT = 'client',
}

/**
 * Alias to `BasedProvider`.
 *
 * @deprecated `Provider` is still working, but we're moving to use `BasedProvider` instead.
 */
const Provider = BasedProvider

export { Provider, BasedProvider }

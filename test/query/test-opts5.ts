type O = { types: any, locales?: any }
type LocalesType<S extends O> = S['locales'] extends string | Record<string, any> ? S['locales'] : {}

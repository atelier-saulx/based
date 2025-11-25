# phase 1

- keep current structure.
- add index.ts on top
- make it build

# phase 2

```
dist/
    ...
src/
    cli/
        ...
    client/
        ...
    protocol/
        ...
    schema/
        ...
    server/
        ...
        uws/
    db/
        clibs/
            include/
                selva/
                ...
            lib/
                deflate/
                jemmalloc/
                selva/
                xxHash/
        native/
            ...
        client/
            modify/
            query/
        server/
            ...
    utils/
    client.ts
    db.ts
    errors.ts
    functions.ts
    hash.ts
    index.ts
    protocol.ts
    react.ts
    schema.ts
    server.ts
    type-gen.ts
    utils.ts
test/
```

# phase 3

```
dist/

src/
    cli/
    client/
    db-client/

    react/
    schema/
    server/
    utils/
scripts/
    build/
    test/
    release/
test/
```

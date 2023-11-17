# based-db

### Release binaries and publish npm packages.

Selvad binaries, db-client and db-server packages should be released though CI/CD.
To release a version use the `Actions > Release` script, or run the `npm run release-publish` command from root.

Ex:
```bash
npm run release-build -- --version v1.2.3 --notes "<optional_release_notes>"
````

This script, when triggered, sets the client and server package versions to the specified version, makes a binary release on GH, publishes the npm packages and creates a new tag.

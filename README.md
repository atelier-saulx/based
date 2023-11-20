# based-db

### Release binaries and publish npm packages.

Selvad binaries, db-client and db-server packages should be released though CI/CD.
To release a version use the `Actions > Release` script, or run the `npm run release-publish` command from root.

Ex:
```bash
npm run release-build -- --version v1.2.3 --notes "<optional_release_notes>"
````

This script, when triggered, sets the client and server package versions to the specified version, makes a binary release on GH, publishes the npm packages and creates a new tag.  
The workflow will take the selected branch (from the UI) or current branch (cli), build the binaries, run all tests and then publish and release. It should take around 10 minutes. It pushes to the branch so be sure to pull the changes once it is done.
You can check the progress from the Actions UI or with `gh workflows view` command. It will send you an email if the workflow fails.

# @based/vscode

Provides autocomplete suggestions with the names of `Based.io` Functions or Queries present in your project.

![VSCode](https://raw.githubusercontent.com/atelier-saulx/based/luiguild/vscode/packages/vscode/VSCode.gif)

Every time you interact with the `useBasedQuery` hook, the first required parameter is the name of the function you want to interact with. Just start typing the function name and suggestions will appear.

To make the suggestions appear, you first need to create your functions and add a `based.config.ts` file as shown in the example below:

```ts
import { BasedFunctionConfig } from '@based/functions'

const config: BasedFunctionConfig = {
  name: 'myFunction',
  type: 'query', // or function
  public: false,
}
export default config
```

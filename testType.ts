import type { ResolveInclude, PickOutput } from './src/db-client/query2/types.js';
import type { BasedQuery2 } from './src/db-client/query2/index.js';

type TestSchema = {
  types: {
    user: {
      props: {
        name: { type: 'string' };
      };
    };
  };
};

type Result = PickOutput<TestSchema, 'user', 'name'>;

let a: Result = { id: 1, name: 'Luigi' };


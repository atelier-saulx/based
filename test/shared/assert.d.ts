import { BasedQueryResponse } from '../../src/db-client/query/BasedQueryResponse.js';
export { perf } from './perf.js';
export declare const deepEqual: (a: any, b: any, msg?: string) => void;
export declare const notEqual: (a: any, b: any, msg?: string) => void;
export declare const equal: (a: any, b: any, msg?: string) => void;
export declare const isSorted: (a: BasedQueryResponse, field: string, order?: "asc" | "desc", msg?: string) => void;
export declare const throws: (fn: () => PromiseLike<any>, logErr?: string | boolean, label?: string) => Promise<void>;
//# sourceMappingURL=assert.d.ts.map
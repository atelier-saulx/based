type Options = {
    repeat?: number;
    timeout?: number;
    silent?: boolean;
    outputFile?: string;
    diffThreshold?: number;
};
export declare function perf(fn: () => void | Promise<void>, label: string, options?: Options): Promise<number>;
export declare namespace perf {
    var skip: (fn: () => void | Promise<void>, label: string, options?: Options) => Promise<void>;
}
export {};
//# sourceMappingURL=perf.d.ts.map
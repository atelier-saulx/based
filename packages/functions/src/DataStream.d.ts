/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { Duplex } from 'stream';
import util from 'node:util';
export declare class BasedDataStream extends Duplex {
    size: number;
    receivedBytes: number;
    progessTimer: NodeJS.Timeout;
    constructor(size: number);
    _read(): void;
    _write(chunk: any, encoding: any, callback: any): void;
    _final(): void;
    [util.inspect.custom](): string;
}

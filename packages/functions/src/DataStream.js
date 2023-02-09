"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasedDataStream = void 0;
const stream_1 = require("stream");
const node_util_1 = __importDefault(require("node:util"));
// prob want to move this to based functions
class BasedDataStream extends stream_1.Duplex {
    constructor(size) {
        super();
        this.size = 0;
        this.receivedBytes = 0;
        this.size = size;
        this.emit('progress', 0);
    }
    _read() { }
    _write(chunk, encoding, callback) {
        this.receivedBytes += chunk.byteLength;
        if (this.size && this.size > 20000) {
            if (!this.progessTimer) {
                this.progessTimer = setTimeout(() => {
                    const progress = this.receivedBytes / this.size;
                    this.emit('progress', progress);
                    this.progessTimer = null;
                }, 200);
            }
        }
        this.push(Buffer.from(chunk, encoding));
        callback();
    }
    _final() {
        if (!this.size) {
            this.size = this.receivedBytes;
        }
        this.receivedBytes = this.size;
        if (this.progessTimer) {
            clearTimeout(this.progessTimer);
            this.progessTimer = null;
        }
        this.emit('progress', 1);
        this.push(null);
    }
    [node_util_1.default.inspect.custom]() {
        if (this.size) {
            const rb = this.receivedBytes < 1000
                ? Math.round(this.receivedBytes / 1024) + 'kb'
                : Math.round(this.receivedBytes / 1024 / 1024) + 'mb';
            return `[BasedStream ${~~((this.receivedBytes / this.size) *
                100)}% ${rb}]`;
        }
        else {
            return `[BasedStream]`;
        }
    }
}
exports.BasedDataStream = BasedDataStream;
//# sourceMappingURL=DataStream.js.map
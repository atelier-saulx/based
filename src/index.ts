import { CompiledRecordDef } from './compiler';
import { serialize } from './serializer';
import {getWriteFunc, getReadFunc} from './accessors';
export { RecordDef, CompiledRecordDef, compile, generateRecordDef } from './compiler';
export { serialize, deserialize } from './serializer';
export { readValue, writeValue, readString, writeString, createReader, createWriter } from './accessors';

export function allocRecord(compiledDef: CompiledRecordDef): Buffer {
	return Buffer.alloc(compiledDef.size);
}

export function createRecord(compiledDef: CompiledRecordDef, obj: any): Buffer {
	const buf = allocRecord(compiledDef);
	serialize(compiledDef, buf, obj);

	return buf;
}

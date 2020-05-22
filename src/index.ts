import { CompiledRecordDef } from './compiler';
import { serialize } from './serializer';
export { RecordDef, CompiledRecordDef, compile, generateRecordDef } from './compiler';
export { serialize, deserialize } from './serializer';
export { readValue, writeValue, readString, writeString, createReader, createWriter } from './accessors';

export function allocRecord(compiledDef: CompiledRecordDef) {
	const buf = Buffer.alloc(compiledDef.size);

	return buf;
}

export function createRecord(compiledDef: CompiledRecordDef, obj: any) {
	const buf = allocRecord(compiledDef);
	serialize(compiledDef, buf, obj);

	return buf;
}

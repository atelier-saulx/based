import { CompiledRecordDef } from './compiler';
import { serialize, getNode } from './serializer';
import { isPointerType } from './types';
export { RecordDef, CompiledRecordDef, compile, generateRecordDef, generateCHeader } from './compiler';
export { serialize, deserialize } from './serializer';
export { readValue, writeValue, readString, writeString, createReader, createWriter } from './accessors';

export function allocRecord(compiledDef: CompiledRecordDef, opts?: { unpool?: boolean; heapSize?: number }): Buffer {
	const heapSize = opts?.heapSize || 0;
	const size = compiledDef.size + heapSize;

	if (!Number.isInteger(heapSize) || heapSize < 0) {
		throw new Error('heapSize must be an integer');
	}

	if (opts?.unpool) {
		return Buffer.allocUnsafeSlow(size).fill(0);
	}
	return Buffer.alloc(size);
}

export function calcHeapSize(compiledDef: CompiledRecordDef, obj: any): number {
	let size = 0;

	for (const [_offet, _typeSize, _arrSize, typeCode, path, fullName] of compiledDef.fieldList) {
		if (isPointerType(typeCode)) {
			const node = getNode(obj, path, fullName);

			size += node ? compiledDef.align(node.length) : 0;
		}
	}

	return size;
}

export function createRecord(compiledDef: CompiledRecordDef, obj: any): Buffer {
	const buf = allocRecord(compiledDef, {
		heapSize: calcHeapSize(compiledDef, obj),
	});

	serialize(compiledDef, buf, obj);

	return buf;
}

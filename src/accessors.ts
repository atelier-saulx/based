import { Encoding } from './types';
import { CompiledRecordDef } from './compiler';

type BufferReadFunction = (offset: number, len: number, encoding: Encoding) => any;

/**
 * Get read functions for a data-record buffer.
 * @param {Buffer} buf is a data-record buffer.
 */
export function getReadFunc(buf: Buffer): { [index: string]: BufferReadFunction } {
	return {
		a: (offset: number): number => buf.readInt8(offset),
		b: (offset: number): number => buf.readInt16BE(offset),
		c: (offset: number): number => buf.readInt16LE(offset),
		d: (offset: number): number => buf.readInt32BE(offset),
		e: (offset: number): number => buf.readInt32LE(offset),
		f: (offset: number): bigint => buf.readBigInt64BE(offset),
		g: (offset: number): bigint => buf.readBigInt64LE(offset),
		h: (offset: number): number => buf.readUInt8(offset),
		i: (offset: number): number => buf.readUInt16BE(offset),
		j: (offset: number): number => buf.readUInt16LE(offset),
		k: (offset: number): number => buf.readUInt32BE(offset),
		l: (offset: number): number => buf.readUInt32LE(offset),
		m: (offset: number): bigint => buf.readBigUInt64BE(offset),
		n: (offset: number): bigint => buf.readBigUInt64LE(offset),
		o: (offset: number): number => buf.readFloatBE(offset),
		p: (offset: number): number => buf.readFloatLE(offset),
		q: (offset: number): number => buf.readDoubleBE(offset),
		r: (offset: number): number => buf.readDoubleLE(offset),
		s: (offset: number, len: number): number => buf.readIntBE(offset, len),
		t: (offset: number, len: number): number => buf.readIntLE(offset, len),
		u: (offset: number, len: number): number => buf.readUIntBE(offset, len),
		v: (offset: number, len: number): number => buf.readUIntLE(offset, len),
		w: (offset: number, len: number, encoding: Encoding): string => buf.toString(encoding, offset, offset + len),
	};
}

type BufferWriteFunction = (v: any, offset: number, len: number, encoding: Encoding) => void;

/**
 * Get write functions for a data-record buffer.
 * @param {Buffer} buf is a data-record buffer.
 */
export function getWriteFunc(buf: Buffer): { [index: string]: BufferWriteFunction } {
	return {
		a: (v: number, offset: number): number => buf.writeInt8(v, offset),
		b: (v: number, offset: number): number => buf.writeInt16BE(v, offset),
		c: (v: number, offset: number): number => buf.writeInt16LE(v, offset),
		d: (v: number, offset: number): number => buf.writeInt32BE(v, offset),
		e: (v: number, offset: number): number => buf.writeInt32LE(v, offset),
		f: (v: bigint, offset: number): number => buf.writeBigInt64BE(v, offset),
		g: (v: bigint, offset: number): number => buf.writeBigInt64LE(v, offset),
		h: (v: number, offset: number): number => buf.writeUInt8(v, offset),
		i: (v: number, offset: number): number => buf.writeUInt16BE(v, offset),
		j: (v: number, offset: number): number => buf.writeUInt16LE(v, offset),
		k: (v: number, offset: number): number => buf.writeUInt32BE(v, offset),
		l: (v: number, offset: number): number => buf.writeUInt32LE(v, offset),
		m: (v: bigint, offset: number): number => buf.writeBigUInt64BE(v, offset),
		n: (v: bigint, offset: number): number => buf.writeBigUInt64LE(v, offset),
		o: (v: number, offset: number): number => buf.writeFloatBE(v, offset),
		p: (v: number, offset: number): number => buf.writeFloatLE(v, offset),
		q: (v: number, offset: number): number => buf.writeDoubleBE(v, offset),
		r: (v: number, offset: number): number => buf.writeDoubleLE(v, offset),
		s: (v: number, offset: number, len: number): number => buf.writeIntBE(v, offset, len),
		t: (v: number, offset: number, len: number): number => buf.writeIntLE(v, offset, len),
		u: (v: number, offset: number, len: number): number => buf.writeUIntBE(v, offset, len),
		v: (v: number, offset: number, len: number): number => buf.writeUIntLE(v, offset, len),
		w: (v: string, offset: number, len: number, encoding: Encoding): number => buf.write(v, offset, len, encoding),
	};
}

export function readValue<T = number | bigint>(compiledDef: CompiledRecordDef, buf: Buffer, path: string): T {
	const funcs = getReadFunc(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	// @ts-ignore
	return funcs[type](offset, size);
}

export function readString(compiledDef: CompiledRecordDef, buf: Buffer, path: string, encoding: Encoding): string {
	const funcs = getReadFunc(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	if (type !== 'w') {
		throw new TypeError('Not a string');
	}

	return funcs[type](offset, size, encoding);
}

export function writeValue(compiledDef: CompiledRecordDef, buf: Buffer, path: string, value: any): void {
	const funcs = getWriteFunc(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	// @ts-ignore
	funcs[type](value, offset, size);
}

export function writeString(
	compiledDef: CompiledRecordDef,
	buf: Buffer,
	path: string,
	value: string,
	encoding: Encoding
): void {
	const funcs = getWriteFunc(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	if (type !== 'w') {
		throw new TypeError('Not a string');
	}

	funcs[type](value, offset, size, encoding);
}

export function createReader(compiledDef: CompiledRecordDef, buf: Buffer, path: string) {
	const funcs = getReadFunc(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	// @ts-ignore
	return () => funcs[type](offset, size);
}

export function createWriter(compiledDef: CompiledRecordDef, buf: Buffer, path: string) {
	const funcs = getWriteFunc(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	// @ts-ignore
	return (value) => funcs[type](value, offset, size);
}

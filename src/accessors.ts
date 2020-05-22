import { Encoding } from './types';
import { CompiledRecordDef } from './compiler';

type BufferReadFunction = (offset: number, len: number, encoding: Encoding) => any;

/**
 * Get read functions for a data-record buffer.
 * @param {Buffer} buf is a data-record buffer.
 */
export function getReadFunc(buf: Buffer): { [index: string]: BufferReadFunction } {
	return {
		a: (offset) => buf.readInt8(offset),
		b: (offset) => buf.readInt16BE(offset),
		c: (offset) => buf.readInt16LE(offset),
		d: (offset) => buf.readInt32BE(offset),
		e: (offset) => buf.readInt32LE(offset),
		f: (offset) => buf.readBigInt64BE(offset),
		g: (offset) => buf.readBigInt64LE(offset),
		h: (offset) => buf.readUInt8(offset),
		i: (offset) => buf.readUInt16BE(offset),
		j: (offset) => buf.readUInt16LE(offset),
		k: (offset) => buf.readUInt32BE(offset),
		l: (offset) => buf.readUInt32LE(offset),
		m: (offset) => buf.readBigUInt64BE(offset),
		n: (offset) => buf.readBigUInt64LE(offset),
		o: (offset) => buf.readFloatBE(offset),
		p: (offset) => buf.readFloatLE(offset),
		q: (offset) => buf.readDoubleBE(offset),
		r: (offset) => buf.readDoubleLE(offset),
		s: (offset, len) => buf.readIntBE(offset, len),
		t: (offset, len) => buf.readIntLE(offset, len),
		u: (offset, len) => buf.readUIntBE(offset, len),
		v: (offset, len) => buf.readUIntLE(offset, len),
		w: (offset, len, encoding) => buf.toString(encoding, offset, offset + len),
	};
}

type BufferWriteFunction = (v: any, offset: number, len: number, encoding: Encoding) => void;

/**
 * Get write functions for a data-record buffer.
 * @param {Buffer} buf is a data-record buffer.
 */
export function getWriteFunc(buf: Buffer): { [index: string]: BufferWriteFunction } {
	return {
		a: (v, offset) => buf.writeInt8(v, offset),
		b: (v, offset) => buf.writeInt16BE(v, offset),
		c: (v, offset) => buf.writeInt16LE(v, offset),
		d: (v, offset) => buf.writeInt32BE(v, offset),
		e: (v, offset) => buf.writeInt32LE(v, offset),
		f: (v, offset) => buf.writeBigInt64BE(v, offset),
		g: (v, offset) => buf.writeBigInt64LE(v, offset),
		h: (v, offset) => buf.writeUInt8(v, offset),
		i: (v, offset) => buf.writeUInt16BE(v, offset),
		j: (v, offset) => buf.writeUInt16LE(v, offset),
		k: (v, offset) => buf.writeUInt32BE(v, offset),
		l: (v, offset) => buf.writeUInt32LE(v, offset),
		m: (v, offset) => buf.writeBigUInt64BE(v, offset),
		n: (v, offset) => buf.writeBigUInt64LE(v, offset),
		o: (v, offset) => buf.writeFloatBE(v, offset),
		p: (v, offset) => buf.writeFloatLE(v, offset),
		q: (v, offset) => buf.writeDoubleBE(v, offset),
		r: (v, offset) => buf.writeDoubleLE(v, offset),
		s: (v, offset, len) => buf.writeIntBE(v, offset, len),
		t: (v, offset, len) => buf.writeIntLE(v, offset, len),
		u: (v, offset, len) => buf.writeUIntBE(v, offset, len),
		v: (v, offset, len) => buf.writeUIntLE(v, offset, len),
		w: (v, offset, len, encoding) => buf.write(v, offset, len, encoding),
	};
}

export function readValue(compiledDef: CompiledRecordDef, buf: Buffer, path: string) {
	const funcs = getReadFunc(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	// @ts-ignore
	return funcs[type](offset, size);
}

export function readString(compiledDef: CompiledRecordDef, buf: Buffer, path: string, encoding: Encoding) {
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

export function writeValue(compiledDef: CompiledRecordDef, buf: Buffer, path: string, value: any) {
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
) {
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

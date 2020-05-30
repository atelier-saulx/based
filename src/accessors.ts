import { Encoding } from './types';
import { CompiledRecordDef } from './compiler';
import { WORD_SIZE, MACH_TYPE } from './mach';

function readWord(buf: Buffer, offset: number): number | bigint {
	switch (MACH_TYPE) {
		case 'BE4':
			return buf.readUInt32BE(offset);
		case 'BE8':
			return buf.readBigUInt64BE(offset);
		case 'LE4':
			return buf.readUInt32LE(offset);
		case 'LE8':
			return buf.readBigUInt64LE(offset);
		default:
			throw new Error('Arch not supported');
	}
}

function bufferReadCstring(buf: Buffer, offset: number, len: number, encoding?: Encoding): Buffer | string {
	if (encoding && ['utf8', 'utf16le', 'latin1', 'ascii'].includes(encoding)) {
		const sub = buf.subarray(offset, offset + len);
		const ind = sub.indexOf(0);
		const str = ind > 0 ? sub.subarray(0, ind) : sub;

		return Buffer.from(str).toString(encoding);
	} else if (encoding) {
		return buf.toString(encoding, offset, offset + len);
	}

	return Buffer.from(buf.subarray(offset, offset + len));
}

function bufferReadCstringP(buf: Buffer, offset: number, _len: number, encoding: Encoding): Buffer | string | null {
	const str_p = Number(readWord(buf, offset));
	const str_len = Number(readWord(buf, offset + WORD_SIZE));

	if (Number(str_p) === 0) {
		return null;
	}

	return bufferReadCstring(buf, str_p, str_len, encoding);
}

function writeWord(buf: Buffer, offset: number, value: number | bigint) {
	switch (MACH_TYPE) {
		case 'BE4':
			buf.writeUInt32BE(Number(value), offset);
			break;
		case 'BE8':
			buf.writeBigUInt64BE(BigInt(value), offset);
			break;
		case 'LE4':
			buf.writeUInt32LE(Number(value), offset);
			break;
		case 'LE8':
			buf.writeBigUInt64LE(BigInt(value), offset);
			break;
		default:
			throw new Error('Arch not supported');
	}
}

function bufferWriteCstringP(
	buf: Buffer,
	offset: number,
	destOffset: number,
	value: string,
	_len: number,
	encoding: Encoding
) {
	if (!value) {
		writeWord(buf, offset, 0);
		writeWord(buf, offset + WORD_SIZE, 0);
		return 0;
	}

	writeWord(buf, offset, destOffset);
	writeWord(buf, offset + WORD_SIZE, value.length);
	return buf.write(value, destOffset, value.length, encoding);
}

type BufferReadFunction = (offset: number, len: number, encoding?: Encoding) => any;

/**
 * Get read functions for a data-record buffer.
 * @param {Buffer} buf is a data-record buffer.
 */
export function getReadFuncs(buf: Buffer): { [index: string]: BufferReadFunction } {
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
		w: (offset: number, len: number, encoding: Encoding): Buffer | string =>
			bufferReadCstring(buf, offset, len, encoding),
		pw: (offset: number, len: number, encoding: Encoding): Buffer | string | null =>
			bufferReadCstringP(buf, offset, len, encoding),
	};
}

type BufferWriteFunction = (v: any, offset: number, len: number, destOffset: number, encoding?: Encoding) => void;

/**
 * Get write functions for a data-record buffer.
 * @param {Buffer} buf is a data-record buffer.
 */
export function getWriteFuncs(buf: Buffer): { [index: string]: BufferWriteFunction } {
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
		w: (v: string, offset: number, len: number, _destOffset: number, encoding: Encoding): number =>
			buf.write(v, offset, len, encoding),
		pw: (v: string, offset: number, len: number, destOffset: number, encoding: Encoding): number =>
			bufferWriteCstringP(buf, offset, destOffset, v, len, encoding),
	};
}

export function readValue<T = number | bigint>(compiledDef: CompiledRecordDef, buf: Buffer, path: string): T {
	const funcs = getReadFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	return funcs[type](offset, size);
}

export function readString(
	compiledDef: CompiledRecordDef,
	buf: Buffer,
	path: string,
	encoding?: Encoding
): ReturnType<typeof bufferReadCstring> {
	const funcs = getReadFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	if (type !== 'w') {
		throw new TypeError('Not a string');
	}

	return funcs[type](offset, size, encoding);
}

export function writeValue<T = number | bigint>(
	compiledDef: CompiledRecordDef,
	buf: Buffer,
	path: string,
	value: T
): void {
	const funcs = getWriteFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	// 0 is a dummy value for headOffset
	funcs[type](value, offset, size, 0);
}

export function writeString(
	compiledDef: CompiledRecordDef,
	buf: Buffer,
	path: string,
	value: string,
	encoding?: Encoding
): void {
	const funcs = getWriteFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	if (type !== 'w') {
		throw new TypeError('Not a string');
	}

	// Zero the buffer section before writing to make sure the string will be
	// null-terminated.
	buf.fill(0, offset, offset + size);

	// 0 is a dummy value for heapOffset
	return funcs[type](value, offset, size, 0, encoding);
}

export function createReader(
	compiledDef: CompiledRecordDef,
	buf: Buffer,
	path: string
): () => ReturnType<BufferReadFunction> {
	const funcs = getReadFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	return (): ReturnType<BufferReadFunction> => funcs[type](offset, size);
}

export function createStringReader(
	compiledDef: CompiledRecordDef,
	buf: Buffer,
	path: string,
	encoding?: Encoding
): () => string | Buffer | null {
	const funcs = getReadFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	if (type !== 'w') {
		throw new TypeError('Not a string');
	}

	return (): string | Buffer | null => funcs[type](offset, size, encoding);
}

export function createWriter(compiledDef: CompiledRecordDef, buf: Buffer, path: string): (value: any) => void {
	const funcs = getWriteFuncs(buf);
	const { offset, size, type } = compiledDef.fieldMap[path] || {};

	if (!type) {
		throw new Error('Not found');
	}

	// 0 is a dummy value for headOffset
	return (value: any): void => funcs[type](value, offset, size, 0);
}

import {
	compile,
	createRecord,
	readValue,
	readString,
	writeValue,
	writeString,
	createReader,
	createStringReader,
	createWriter,
} from '../src/index';

const def = [
	{ name: 'a', type: 'int8' },
	{ name: 'b', type: 'int16' },
	{ name: 'c', type: 'int16_be' },
	{ name: 'd', type: 'int16_le' },
	{ name: 'e', type: 'int32' },
	{ name: 'f', type: 'int32_be' },
	{ name: 'g', type: 'int32_le' },
	{ name: 'h', type: 'int64' },
	{ name: 'i', type: 'int64_be' },
	{ name: 'j', type: 'int64_le' },
	{ name: 'k', type: 'uint8' },
	{ name: 'l', type: 'uint16' },
	{ name: 'm', type: 'uint16_be' },
	{ name: 'n', type: 'uint16_le' },
	{ name: 'o', type: 'uint32' },
	{ name: 'p', type: 'uint32_be' },
	{ name: 'q', type: 'uint32_le' },
	{ name: 'r', type: 'uint64' },
	{ name: 's', type: 'uint64_be' },
	{ name: 't', type: 'uint64_le' },
	{ name: 'u', type: 'float' },
	{ name: 'v', type: 'float_be' },
	{ name: 'w', type: 'float_le' },
	{ name: 'x', type: 'double' },
	{ name: 'y', type: 'double_be' },
	{ name: 'z', type: 'double_le' },
	{ name: '0', type: 'int', size: 3 },
	{ name: '1', type: 'int_be', size: 3 },
	{ name: '2', type: 'int_le', size: 3 },
	{ name: '3', type: 'uint', size: 3 },
	{ name: '4', type: 'uint_be', size: 3 },
	{ name: '5', type: 'uint_le', size: 3 },
	{ name: '6', type: 'cstring', size: 10 },
	{ name: '7', type: 'cstring_p' },
];
const obj = {
	a: -127,
	b: 0x4020,
	c: 0x4020,
	d: 0x4020,
	e: 0x10004020,
	f: 0x10004020,
	g: 0x10004020,
	h: BigInt('0x40400010004020'),
	i: BigInt('0x40400010004020'),
	j: BigInt('0x40400010004020'),
	k: 127,
	l: 0x4020,
	m: 0x4020,
	n: 0x4020,
	o: 0x10004020,
	p: 0x10004020,
	q: 0x10004020,
	r: BigInt('0x40400010004020'),
	s: BigInt('0x40400010004020'),
	t: BigInt('0x40400010004020'),
	u: 1.5,
	v: 1.5,
	w: 1.5,
	x: 1.2345,
	y: 1.2345,
	z: 1.2345,
	0: 0x414141,
	1: 0x414141,
	2: 0x414141,
	3: 0x414141,
	4: 0x414141,
	5: 0x414141,
	6: 'hello',
	7: 'ciao',
};
const compiled = compile(def);

Object.freeze(def);
Object.freeze(obj);
Object.freeze(compiled);

describe('Test createReader accessors', () => {
	test('createReader() int8', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.a');

		expect(read()).toBe(-127);
	});

	test('createReader() int16', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.b');

		expect(read()).toBe(0x4020);
	});

	test('createReader() int16_be', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.c');

		expect(read()).toBe(0x4020);
	});

	test('createReader() int16_le', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.d');

		expect(read()).toBe(0x4020);
	});

	test('createReader() int32', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.e');

		expect(read()).toBe(0x10004020);
	});

	test('createReader() int32_be', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.f');

		expect(read()).toBe(0x10004020);
	});

	test('createReader() int32_le', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.g');

		expect(read()).toBe(0x10004020);
	});

	test('createReader() int64', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.h');

		expect(read()).toBe(BigInt('0x40400010004020'));
	});

	test('createReader() int64_be', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.i');

		expect(read()).toBe(BigInt('0x40400010004020'));
	});

	test('createReader() int64_le', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.j');

		expect(read()).toBe(BigInt('0x40400010004020'));
	});

	test('createReader() uint8_t', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.k');

		expect(read()).toBe(127);
	});

	test('createReader() uint16', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.l');

		expect(read()).toBe(0x4020);
	});

	test('createReader() uint16_be', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.m');

		expect(read()).toBe(0x4020);
	});

	test('createReader() uint16_le', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.n');

		expect(read()).toBe(0x4020);
	});

	test('createReader() uint32', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.o');

		expect(read()).toBe(0x10004020);
	});

	test('createReader() uint32_be', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.p');

		expect(read()).toBe(0x10004020);
	});

	test('createReader() uint32_le', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.q');

		expect(read()).toBe(0x10004020);
	});

	test('createReader() uint64', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.r');

		expect(read()).toBe(BigInt('0x40400010004020'));
	});

	test('createReader() uint64_be', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.s');

		expect(read()).toBe(BigInt('0x40400010004020'));
	});

	test('createReader() uint64_le', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.t');

		expect(read()).toBe(BigInt('0x40400010004020'));
	});

	test('createReader() float', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.u');

		expect(read()).toBe(1.5);
	});

	test('createReader() float_be', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.v');

		expect(read()).toBe(1.5);
	});

	test('createReader() float_le', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.w');

		expect(read()).toBe(1.5);
	});

	test('createReader() double', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.x');

		expect(read()).toBe(1.2345);
	});

	test('createReader() double_be', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.y');

		expect(read()).toBe(1.2345);
	});

	test('createReader() double_le', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.z');

		expect(read()).toBe(1.2345);
	});

	test('createReader() int', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.0');

		expect(read()).toBe(0x414141);
	});

	test('createReader() int_be', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.1');

		expect(read()).toBe(0x414141);
	});

	test('createReader() int_le', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.2');

		expect(read()).toBe(0x414141);
	});

	test('createReader() uint', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.3');

		expect(read()).toBe(0x414141);
	});

	test('createReader() uint_be', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.4');

		expect(read()).toBe(0x414141);
	});

	test('createReader() uint_le', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.5');

		expect(read()).toBe(0x414141);
	});

	test('createReader() utf8 cstring', () => {
		const buf = createRecord(compiled, obj);
		const read = createStringReader(compiled, buf, '.6', 'utf8');

		expect(read()).toBe('hello');
	});

	test('createReader() ascii cstring', () => {
		const buf = createRecord(compiled, obj);
		const read = createStringReader(compiled, buf, '.6', 'ascii');

		const val = read();
		expect(val).toBe('hello');
	});

	test('createReader() buffer cstring', () => {
		const buf = createRecord(compiled, obj);
		const read = createStringReader(compiled, buf, '.6');

		const val = read();
		expect(Buffer.isBuffer(val)).toBeTruthy();
		expect(val?.toString('hex')).toBe('68656c6c6f0000000000');
	});

	test.skip('createReader() utf8 cstring_p', () => {
		const buf = createRecord(compiled, obj);
		const read = createStringReader(compiled, buf, '.7', 'utf8');

		const val = read();
		expect(val).toBe('ciao');
	});

	test('createReader() ascii cstring_p', () => {
		const buf = createRecord(compiled, obj);
		const read = createStringReader(compiled, buf, '.7', 'ascii');

		const val = read();
		expect(val).toBe('ciao');
	});

	test('createReader() buffer cstring_p', () => {
		const buf = createRecord(compiled, obj);
		const read = createStringReader(compiled, buf, '.7');

		const val = read();
		expect(Buffer.isBuffer(val)).toBeTruthy();
		expect(val?.toString('hex')).toBe('6369616f');
	});
});

describe('Test createWriter accessors', () => {
	test('createWriter() int8', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.a');
		const write = createWriter(compiled, buf, '.a');

		write(127);
		expect(read()).toBe(127);
	});

	test('createWriter() int16', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.b');
		const write = createWriter(compiled, buf, '.b');

		write(0x1512);
		expect(read()).toBe(0x1512);
	});

	test('createWriter() int16_be', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.c');
		const write = createWriter(compiled, buf, '.c');

		write(0x1512);
		expect(read()).toBe(0x1512);
	});

	test('createWriter() int16_le', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.d');
		const write = createWriter(compiled, buf, '.d');

		write(0x1512);
		expect(read()).toBe(0x1512);
	});

	test('createWriter() int32', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.e');
		const write = createWriter(compiled, buf, '.e');

		write(0x41512);
		expect(read()).toBe(0x41512);
	});

	test('createWriter() int32_be', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.f');
		const write = createWriter(compiled, buf, '.f');

		write(0x41512);
		expect(read()).toBe(0x41512);
	});

	test('createWriter() int32_le', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.g');
		const write = createWriter(compiled, buf, '.g');

		write(0x41512);
		expect(read()).toBe(0x41512);
	});

	test('createWriter() int64', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.h');
		const write = createWriter(compiled, buf, '.h');

		write(BigInt('0x40410014004020'));
		expect(read()).toBe(BigInt('0x40410014004020'));
	});

	test('createWriter() int64_be', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.i');
		const write = createWriter(compiled, buf, '.i');

		write(BigInt('0x40410014004020'));
		expect(read()).toBe(BigInt('0x40410014004020'));
	});

	test('createWriter() int64_le', () => {
		const buf = createRecord(compiled, obj);
		const read = createReader(compiled, buf, '.j');
		const write = createWriter(compiled, buf, '.j');

		write(BigInt('0x40410014004020'));
		expect(read()).toBe(BigInt('0x40410014004020'));
	});

	test('createWriter() cstring', () => {
		const buf = createRecord(compiled, obj);
		const read = createStringReader(compiled, buf, '.6', 'utf8');
		const write = createWriter(compiled, buf, '.6');

		// Note that the writer doesn't not clear the string
		write('ab');
		expect(read()).toBe('abllo');
	});

	test('createWriter() cstring buffer', () => {
		const buf = createRecord(compiled, obj);
		const read = createStringReader(compiled, buf, '.6', 'utf8');
		const write = createWriter(compiled, buf, '.6');

		// Note that the writer doesn't not clear the string
		write(Buffer.from('buffero'));
		expect(read()).toBe('buffero');
	});

	test('createWriter() cstring nul-terminating', () => {
		const buf = createRecord(compiled, obj);
		const read = createStringReader(compiled, buf, '.6', 'utf8');
		const write = createWriter(compiled, buf, '.6');

		// Note that the writer doesn't not clear the string
		write('ab\0');
		expect(read()).toBe('ab');
	});
});

describe('Test createReader error handling', () => {
	test('readValue() throws not found', () => {
		const buf = createRecord(compiled, obj);
		expect(() => readValue(compiled, buf, '.not_found')).toThrowError(/Not found/);
	});

	test('readString() throws not found', () => {
		const buf = createRecord(compiled, obj);
		expect(() => readString(compiled, buf, '.not_found')).toThrowError(/Not found/);
	});

	test('readString() throws not a string', () => {
		const buf = createRecord(compiled, obj);
		expect(() => readString(compiled, buf, '.a')).toThrowError(/Not a string/);
	});

	test('writeValue() throws not found', () => {
		const buf = createRecord(compiled, obj);
		expect(() => writeValue(compiled, buf, '.not_found', 100)).toThrowError(/Not found/);
	});

	test('writeValue() throws cannot write to a pointer', () => {
		const buf = createRecord(compiled, obj);
		expect(() => writeValue(compiled, buf, '.7', 100)).toThrowError(/Cannot write to a pointer/);
	});

	test('writeString() throws not found', () => {
		const buf = createRecord(compiled, obj);
		expect(() => writeString(compiled, buf, '.not_found', 'zyx')).toThrowError(/Not found/);
	});

	test('writeString() throws not a string', () => {
		const buf = createRecord(compiled, obj);
		expect(() => writeString(compiled, buf, '.a', 'zyx')).toThrowError(/Not a string/);
	});

	test('createReader() throws not found', () => {
		const buf = createRecord(compiled, obj);
		expect(() => createReader(compiled, buf, '.not_found')).toThrowError(/Not found/);
	});

	test('createStringReader() throws not found', () => {
		const buf = createRecord(compiled, obj);
		expect(() => createStringReader(compiled, buf, '.not_found')).toThrowError(/Not found/);
	});

	test('createStringReader() throws not a string', () => {
		const buf = createRecord(compiled, obj);
		expect(() => createStringReader(compiled, buf, '.c')).toThrowError(/Not a string/);
	});

	test('createWriter() throws not supported for cstring_p', () => {
		const buf = createRecord(compiled, obj);
		expect(() => createWriter(compiled, buf, '.7')).toThrowError(/not supported/);
	});

	test('createWriter() throws not found', () => {
		const buf = createRecord(compiled, obj);
		expect(() => createWriter(compiled, buf, '.not_found')).toThrowError(/Not found/);
	});
});

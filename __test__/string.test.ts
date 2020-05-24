import { compile, createRecord, readValue, readString, writeString } from '../src/index';

const CANARY = 0xffffffff;

const recordDef = [
	{ name: 'str', type: 'cstring', size: 5 },
	{ name: 'canary', type: 'uint32_le' },
];

const compiled = compile(recordDef);

test("Test that a normal string write doesn't overwrite", () => {
	const buf = createRecord(compiled, { str: 'abc', canary: CANARY });

	expect(readString(compiled, buf, '.str', 'utf8')).toBe('abc');
	expect(readValue(compiled, buf, '.canary')).toBe(CANARY);
});

test('Test that max length string works', () => {
	const buf = createRecord(compiled, { str: 'abcde', canary: CANARY });

	expect(readString(compiled, buf, '.str', 'utf8')).toBe('abcde');
	expect(readValue(compiled, buf, '.canary')).toBe(CANARY);
});

test("Test that a too long string doesn't overwrite", () => {
	const buf = createRecord(compiled, { str: 'abcdef', canary: CANARY });

	expect(readString(compiled, buf, '.str', 'utf8')).toBe('abcde');
	expect(readValue(compiled, buf, '.canary')).toBe(CANARY);
});

test('writeString() zeroes the rest', () => {
	const buf = createRecord(compiled, { str: '', canary: CANARY });

	writeString(compiled, buf, '.str', 'a');
	const read = readString(compiled, buf, '.str', 'hex');

	expect(read).toBe('6100000000');
});

test('writeString() returns the string len written', () => {
	const buf = createRecord(compiled, { str: '', canary: CANARY });

	const written = writeString(compiled, buf, '.str', 'abc');

	expect(written).toBe(3);
});

test('writeString() returns less than string length for too long string', () => {
	const buf = createRecord(compiled, { str: '', canary: CANARY });

	const written = writeString(compiled, buf, '.str', 'abcdef');

	expect(written).toBe(5);
});

test('readValue() returns a proper buffer for a string', () => {
	const buf = createRecord(compiled, { str: 'a', canary: CANARY });

	const read = readValue<Buffer>(compiled, buf, '.str');

	expect(Buffer.isBuffer(read)).toBeTruthy();
	expect(read.toString('hex')).toBe('6100000000');
});

test('readString() with no encoding returns a proper buffer', () => {
	const buf = createRecord(compiled, { str: 'a', canary: CANARY });

	const read = readString(compiled, buf, '.str');

	expect(Buffer.isBuffer(read)).toBeTruthy();
	expect(read.toString('hex')).toBe('6100000000');
});

test("readString() with 'utf8' returns a proper string", () => {
	const buf = createRecord(compiled, { str: 'ä', canary: CANARY });

	const read = readString(compiled, buf, '.str', 'utf8');

	expect(read).toBe('ä');
});

test("readString() with 'ascii' returns a proper string", () => {
	const buf = createRecord(compiled, { str: 'a', canary: CANARY });

	const read = readString(compiled, buf, '.str', 'ascii');

	expect(read).toBe('a');
});

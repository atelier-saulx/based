import { compile, allocRecord, writeValue, readValue } from '../src/index';

describe('Test that each type writes a proper value', () => {
	test('int8', () => {
		const def = [{ name: 'a', type: 'int8' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', -127);
		expect(buf.toString('hex')).toBe('81');
	});

	test('int16_be', () => {
		const def = [{ name: 'a', type: 'int16_be' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x1234);
		expect(buf.toString('hex')).toBe('1234');
	});

	test('int16_le', () => {
		const def = [{ name: 'a', type: 'int16_le' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x1234);
		expect(buf.toString('hex')).toBe('3412');
	});

	test('int32_be', () => {
		const def = [{ name: 'a', type: 'int32_be' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x12345678);
		expect(buf.toString('hex')).toBe('12345678');
	});

	test('int32_le', () => {
		const def = [{ name: 'a', type: 'int32_le' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x12345678);
		expect(buf.toString('hex')).toBe('78563412');
	});

	test('int64_be', () => {
		const def = [{ name: 'a', type: 'int64_be' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'));
		expect(buf.toString('hex')).toBe('0deface0deadbeef');
	});

	test('int64_le', () => {
		const def = [{ name: 'a', type: 'int64_le' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'));
		expect(buf.toString('hex')).toBe('efbeaddee0acef0d');
	});

	test('uint8', () => {
		const def = [{ name: 'a', type: 'uint8' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 254);
		expect(buf.toString('hex')).toBe('fe');
	});

	test('uint16_be', () => {
		const def = [{ name: 'a', type: 'uint16_be' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x1234);
		expect(buf.toString('hex')).toBe('1234');
	});

	test('uint16_le', () => {
		const def = [{ name: 'a', type: 'uint16_le' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x1234);
		expect(buf.toString('hex')).toBe('3412');
	});

	test('uint32_be', () => {
		const def = [{ name: 'a', type: 'uint32_be' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x12345678);
		expect(buf.toString('hex')).toBe('12345678');
	});

	test('uint32_le', () => {
		const def = [{ name: 'a', type: 'uint32_le' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x12345678);
		expect(buf.toString('hex')).toBe('78563412');
	});

	test('uint64_be', () => {
		const def = [{ name: 'a', type: 'uint64_be' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'));
		expect(buf.toString('hex')).toBe('0deface0deadbeef');
	});

	test('uint64_le', () => {
		const def = [{ name: 'a', type: 'uint64_le' }];
		const compiled = compile(def);
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'));
		expect(buf.toString('hex')).toBe('efbeaddee0acef0d');
	});

	/*
	 * TODO
	 * float_be: 'o',
	 * float_le: 'p',
	 * double_be: 'q',
	 * double_le: 'r',
	 */
});

describe('Test that each type reads a proper value', () => {
	test('int8', () => {
		const def = [{ name: 'a', type: 'int8' }];
		const compiled = compile(def);
		const buf = Buffer.from('81', 'hex');
		const value = readValue(compiled, buf, '.a');

		expect(value).toBe(-127);
	});
});

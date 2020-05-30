import { ENDIANNESS } from '../src/mach';
import { compile, allocRecord, writeValue, readValue } from '../src/index';

describe('Test that each type writes the correct value', () => {
	test('int8', () => {
		const def = [{ name: 'a', type: 'int8' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', -127);
		expect(buf.toString('hex')).toBe('81');
	});

	test('int16', () => {
		const def = [{ name: 'a', type: 'int16' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x1234);
		if (ENDIANNESS === 'BE') {
			expect(buf.toString('hex')).toBe('1234');
		} else {
			expect(buf.toString('hex')).toBe('3412');
		}
	});

	test('int16_be', () => {
		const def = [{ name: 'a', type: 'int16_be' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x1234);
		expect(buf.toString('hex')).toBe('1234');
	});

	test('int16_le', () => {
		const def = [{ name: 'a', type: 'int16_le' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x1234);
		expect(buf.toString('hex')).toBe('3412');
	});

	test('int32', () => {
		const def = [{ name: 'a', type: 'int32' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x12345678);
		if (ENDIANNESS === 'BE') {
			expect(buf.toString('hex')).toBe('12345678');
		} else {
			expect(buf.toString('hex')).toBe('78563412');
		}
	});

	test('int32_be', () => {
		const def = [{ name: 'a', type: 'int32_be' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x12345678);
		expect(buf.toString('hex')).toBe('12345678');
	});

	test('int32_le', () => {
		const def = [{ name: 'a', type: 'int32_le' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x12345678);
		expect(buf.toString('hex')).toBe('78563412');
	});

	test('int64', () => {
		const def = [{ name: 'a', type: 'int64' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'));
		if (ENDIANNESS === 'BE') {
			expect(buf.toString('hex')).toBe('0deface0deadbeef');
		} else {
			expect(buf.toString('hex')).toBe('efbeaddee0acef0d');
		}
	});

	test('int64_be', () => {
		const def = [{ name: 'a', type: 'int64_be' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'));
		expect(buf.toString('hex')).toBe('0deface0deadbeef');
	});

	test('int64_le', () => {
		const def = [{ name: 'a', type: 'int64_le' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'));
		expect(buf.toString('hex')).toBe('efbeaddee0acef0d');
	});

	test('uint8', () => {
		const def = [{ name: 'a', type: 'uint8' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 254);
		expect(buf.toString('hex')).toBe('fe');
	});

	test('uint16', () => {
		const def = [{ name: 'a', type: 'uint16' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x1234);
		if (ENDIANNESS === 'BE') {
			expect(buf.toString('hex')).toBe('1234');
		} else {
			expect(buf.toString('hex')).toBe('3412');
		}
	});

	test('uint16_be', () => {
		const def = [{ name: 'a', type: 'uint16_be' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x1234);
		expect(buf.toString('hex')).toBe('1234');
	});

	test('uint16_le', () => {
		const def = [{ name: 'a', type: 'uint16_le' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x1234);
		expect(buf.toString('hex')).toBe('3412');
	});

	test('uint32', () => {
		const def = [{ name: 'a', type: 'uint32' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x12345678);
		if (ENDIANNESS === 'BE') {
			expect(buf.toString('hex')).toBe('12345678');
		} else {
			expect(buf.toString('hex')).toBe('78563412');
		}
	});

	test('uint32_be', () => {
		const def = [{ name: 'a', type: 'uint32_be' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x12345678);
		expect(buf.toString('hex')).toBe('12345678');
	});

	test('uint32_le', () => {
		const def = [{ name: 'a', type: 'uint32_le' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 0x12345678);
		expect(buf.toString('hex')).toBe('78563412');
	});

	test('uint64', () => {
		const def = [{ name: 'a', type: 'uint64' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'));
		if (ENDIANNESS === 'BE') {
			expect(buf.toString('hex')).toBe('0deface0deadbeef');
		} else {
			expect(buf.toString('hex')).toBe('efbeaddee0acef0d');
		}
	});

	test('uint64_be', () => {
		const def = [{ name: 'a', type: 'uint64_be' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'));
		expect(buf.toString('hex')).toBe('0deface0deadbeef');
	});

	test('uint64_le', () => {
		const def = [{ name: 'a', type: 'uint64_le' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', BigInt('0xdeface0deadbeef'));
		expect(buf.toString('hex')).toBe('efbeaddee0acef0d');
	});

	test('float', () => {
		const def = [{ name: 'a', type: 'float' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 1.5);
		if (ENDIANNESS === 'BE') {
			expect(buf.readFloatBE()).toBe(1.5);
		} else {
			expect(buf.readFloatLE()).toBe(1.5);
		}
	});

	test('float_be', () => {
		const def = [{ name: 'a', type: 'float_be' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 1.5);
		expect(buf.readFloatBE()).toBe(1.5);
	});

	test('float_le', () => {
		const def = [{ name: 'a', type: 'float_le' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 1.5);
		expect(buf.readFloatLE()).toBe(1.5);
	});

	test('double', () => {
		const def = [{ name: 'a', type: 'double' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 1.2345);
		if (ENDIANNESS === 'BE') {
			expect(buf.readDoubleBE()).toBe(1.2345);
		} else {
			expect(buf.readDoubleLE()).toBe(1.2345);
		}
	});

	test('double_be', () => {
		const def = [{ name: 'a', type: 'double_be' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 1.2345);
		expect(buf.readDoubleBE()).toBe(1.2345);
	});

	test('double_le', () => {
		const def = [{ name: 'a', type: 'double_le' }];
		const compiled = compile(def, { align: false });
		const buf = allocRecord(compiled);

		writeValue(compiled, buf, '.a', 1.2345);
		expect(buf.readDoubleLE()).toBe(1.2345);
	});
});

describe('Test that each type reads the correct value', () => {
	test('int8', () => {
		const def = [{ name: 'a', type: 'int8' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('81', 'hex');
		expect(buf).toHaveLength(1);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(-127);
	});

	test('int16', () => {
		const def = [{ name: 'a', type: 'int16' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('1234', 'hex');
		expect(buf).toHaveLength(2);

		const value = readValue(compiled, buf, '.a');
		if (ENDIANNESS === 'BE') {
			expect(value).toBe(0x1234);
		} else {
			expect(value).toBe(0x3412);
		}
	});

	test('int16_be', () => {
		const def = [{ name: 'a', type: 'int16_be' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('1234', 'hex');
		expect(buf).toHaveLength(2);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(0x1234);
	});

	test('int16_le', () => {
		const def = [{ name: 'a', type: 'int16_le' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('1234', 'hex');
		expect(buf).toHaveLength(2);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(0x3412);
	});

	test('int32', () => {
		const def = [{ name: 'a', type: 'int32' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('12345678', 'hex');
		expect(buf).toHaveLength(4);

		const value = readValue(compiled, buf, '.a');
		if (ENDIANNESS === 'BE') {
			expect(value).toBe(0x12345678);
		} else {
			expect(value).toBe(0x78563412);
		}
	});

	test('int32_be', () => {
		const def = [{ name: 'a', type: 'int32_be' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('12345678', 'hex');
		expect(buf).toHaveLength(4);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(0x12345678);
	});

	test('int32_le', () => {
		const def = [{ name: 'a', type: 'int32_le' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('12345678', 'hex');
		expect(buf).toHaveLength(4);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(0x78563412);
	});

	test('int64', () => {
		const def = [{ name: 'a', type: 'int64' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('000000ba55000000', 'hex');
		expect(buf).toHaveLength(8);

		const value = readValue(compiled, buf, '.a');
		if (ENDIANNESS === 'BE') {
			expect(value).toBe(BigInt('0xba55000000'));
		} else {
			expect(value).toBe(BigInt('0x55ba000000'));
		}
	});

	test('int64_be', () => {
		const def = [{ name: 'a', type: 'int64_be' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('0deface0deadbeef', 'hex');
		expect(buf).toHaveLength(8);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(BigInt('0xdeface0deadbeef'));
	});

	test('int64_le', () => {
		const def = [{ name: 'a', type: 'int64_le' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('efbeaddee0acef0d', 'hex');
		expect(buf).toHaveLength(8);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(BigInt('0xdeface0deadbeef'));
	});

	test('uint8', () => {
		const def = [{ name: 'a', type: 'uint8' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('fe', 'hex');
		expect(buf).toHaveLength(1);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(254);
	});

	test('uint16', () => {
		const def = [{ name: 'a', type: 'uint16' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('1234', 'hex');
		expect(buf).toHaveLength(2);

		const value = readValue(compiled, buf, '.a');
		if (ENDIANNESS === 'BE') {
			expect(value).toBe(0x1234);
		} else {
			expect(value).toBe(0x3412);
		}
	});

	test('uint16_be', () => {
		const def = [{ name: 'a', type: 'uint16_be' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('1234', 'hex');
		expect(buf).toHaveLength(2);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(0x1234);
	});

	test('uint16_le', () => {
		const def = [{ name: 'a', type: 'uint16_le' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('1234', 'hex');
		expect(buf).toHaveLength(2);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(0x3412);
	});

	test('uint32', () => {
		const def = [{ name: 'a', type: 'uint32' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('12345678', 'hex');
		expect(buf).toHaveLength(4);

		const value = readValue(compiled, buf, '.a');
		if (ENDIANNESS === 'BE') {
			expect(value).toBe(0x12345678);
		} else {
			expect(value).toBe(0x78563412);
		}
	});

	test('uint32_be', () => {
		const def = [{ name: 'a', type: 'uint32_be' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('12345678', 'hex');
		expect(buf).toHaveLength(4);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(0x12345678);
	});

	test('uint32_le', () => {
		const def = [{ name: 'a', type: 'uint32_le' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('12345678', 'hex');
		expect(buf).toHaveLength(4);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(0x78563412);
	});

	test('uint64', () => {
		const def = [{ name: 'a', type: 'uint64' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('0deface0deadbeef', 'hex');
		expect(buf).toHaveLength(8);

		const value = readValue(compiled, buf, '.a');
		if (ENDIANNESS === 'BE') {
			expect(value).toBe(BigInt('0xdeface0deadbeef'));
		} else {
			expect(value).toBe(BigInt('0xefbeaddee0acef0d'));
		}
	});

	test('uint64_be', () => {
		const def = [{ name: 'a', type: 'uint64_be' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('0deface0deadbeef', 'hex');
		expect(buf).toHaveLength(8);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(BigInt('0xdeface0deadbeef'));
	});

	test('uint64_le', () => {
		const def = [{ name: 'a', type: 'uint64_le' }];
		const compiled = compile(def, { align: false });
		const buf = Buffer.from('0deface0deadbeef', 'hex');
		expect(buf).toHaveLength(8);

		const value = readValue(compiled, buf, '.a');
		expect(value).toBe(BigInt('0xefbeaddee0acef0d'));
	});
});

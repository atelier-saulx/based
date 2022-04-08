import { allocRecord, compile, generateRecordDef } from '../src/index';
import { ENDIANNESS } from '../src/mach';

describe('Memory allocation', () => {
	const def = [{ type: 'cstring_p', name: 's' }];
	const compiled = compile(def);

	test('Throws if heapsize is not an integer', () => {
		expect(() => allocRecord(compiled, { heapSize: 10.5 })).toThrowError(/heapSize must be an integer/);
	});

	test('Allocate unpooled', () => {
		expect(allocRecord(compiled, { unpool: true })).toHaveProperty('copy');
	});
});

describe('generateRecordDef()', () => {
	test('Generates a somewhat sane definition', () => {
		const obj = {
			value: 1,
			num: 1.2345,
			text: 'hello',
		};
		const def = generateRecordDef(obj);

		[
			{ name: 'value', type: 'double_le' },
			{ name: 'num', type: 'double_le' },
			{ name: 'text', type: 'cstring', size: 5 },
		];

		if (ENDIANNESS === 'BE') {
			expect(def[0]).toEqual({ name: 'value', type: 'double_be' });
			expect(def[1]).toEqual({ name: 'num', type: 'double_be' });
		} else {
			expect(def[0]).toEqual({ name: 'value', type: 'double_le' });
			expect(def[1]).toEqual({ name: 'num', type: 'double_le' });
		}
		expect(def[2]).toEqual({ name: 'text', type: 'cstring', size: 5 });
	});
});

describe('Test compiler error scenarios', () => {
	test('Not an array', () => {
		const def = {
			a: { type: 'uint8' },
		};

		// @ts-expect-error
		expect(() => compile(def)).toThrowError(TypeError);
	});

	test('Field names must be unique', () => {
		const def = [
			{ name: 'a', type: 'uint8' },
			{ name: 'a', type: 'uint32' },
		];

		expect(() => compile(def)).toThrowError(/already defined/);
	});

	test('Unknown type is rejected', () => {
		const def = [{ name: 'a', type: 'uint128' }];

		expect(() => compile(def)).toThrowError(TypeError);
	});

	test('Invalid array size: negative', () => {
		const def = [{ name: 'a', type: 'uint8[-1]' }];

		expect(() => compile(def)).toThrowError(TypeError);
	});

	test('Invalid array size: float', () => {
		const def = [{ name: 'a', type: 'uint8[1.5]' }];

		expect(() => compile(def)).toThrowError(TypeError);
	});

	test('Invalid array size: wrong type', () => {
		const def = [{ name: 'a', type: 'uint8[hello]' }];

		expect(() => compile(def)).toThrowError(TypeError);
	});

	test('Subrecord needs a definition', () => {
		const def = [{ name: 'a', type: 'record' }];

		expect(() => compile(def)).toThrowError(TypeError);
	});

	test('Variable sized type errors: size must be an integer', () => {
		const def = [{ name: 'a', type: 'int', size: 1.5 }];

		expect(() => compile(def)).toThrowError(Error);
	});

	test('Variable sized type errors: size must be positive', () => {
		const def = [{ name: 'a', type: 'int', size: -1 }];

		expect(() => compile(def)).toThrowError(Error);
	});

	test('Variable sized type errors: size must be a number', () => {
		const def = [{ name: 'a', type: 'int', size: 'hello' }];

		// @ts-expect-error
		expect(() => compile(def)).toThrowError(Error);
	});
});

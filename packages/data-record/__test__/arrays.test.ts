import { compile, createRecord, deserialize } from '../src/index'

describe('Test that various kinds of arrays are serialized as expected', () => {
	test('int8[1]', () => {
		const def = [{ name: 'a', type: 'int8[1]' }]
		const compiled = compile(def, { align: false })
		const buf = createRecord(compiled, {
			a: [1],
		})

		expect(buf.length).toBe(1)
		expect(buf.toString('hex')).toBe('01')
	})

	test('serializing int8[2]', () => {
		const def = [{ name: 'a', type: 'int8[2]' }]
		const compiled = compile(def, { align: false })
		const buf = createRecord(compiled, {
			a: [1, 2],
		})

		expect(buf.length).toBe(2)
		expect(buf.toString('hex')).toBe('0102')
	})

	test('serializing cstring[2]', () => {
		const def = [{ name: 'a', type: 'cstring[2]', size: 10 }]
		const compiled = compile(def, { align: false })
		const buf = createRecord(compiled, {
			a: ['hello', 'world'],
		})

		expect(buf.length).toBe(2 * 10)
		expect(buf.toString('utf8')).toBe('hello\0\0\0\0\0world\0\0\0\0\0')
	})

	test('serializing record[2]', () => {
		const def = [
			{
				name: 'a',
				type: 'record[2]',
				def: [{ name: 'value', type: 'uint32_be' }],
			},
		]
		const compiled = compile(def, { align: false })
		const buf = createRecord(compiled, {
			a: [{ value: 1337 }, { value: 42069 }],
		})

		expect(buf.length).toBe(2 * 4)
		expect(buf.toString('hex')).toBe('000005390000a455')
	})

	test('serializing record[i].record', () => {
		const def = [
			{
				name: 'a',
				type: 'record[2]',
				def: [
					{
						name: 'nest',
						type: 'record',
						def: [{ name: 'value', type: 'uint32_be' }],
					},
				],
			},
		]
		const compiled = compile(def, { align: false })
		const buf = createRecord(compiled, {
			a: [{ nest: { value: 1337 } }, { nest: { value: 42069 } }],
		})

		expect(buf.length).toBe(2 * 4)
		expect(buf.toString('hex')).toBe('000005390000a455')
	})

	test('serializing record.record[i]', () => {
		const def = [
			{
				name: 'a',
				type: 'record',
				def: [
					{
						name: 'nest',
						type: 'record[2]',
						def: [{ name: 'value', type: 'uint32_be' }],
					},
				],
			},
		]
		const compiled = compile(def, { align: false })
		const buf = createRecord(compiled, {
			a: { nest: [{ value: 1337 }, { value: 42069 }] },
		})

		expect(buf.length).toBe(2 * 4)
		expect(buf.toString('hex')).toBe('000005390000a455')
	})

	test('serializing record.record[i].record', () => {
		const def = [
			{
				name: 'a',
				type: 'record',
				def: [
					{
						name: 'nesta',
						type: 'record[2]',
						def: [
							{
								name: 'nestb',
								type: 'record',
								def: [{ name: 'value', type: 'uint32_be' }],
							},
						],
					},
				],
			},
		]
		const compiled = compile(def, { align: false })
		const buf = createRecord(compiled, {
			a: {
				nesta: [
					{ nestb: { value: 1337 } },
					{ nestb: { value: 42069 } },
				],
			},
		})

		expect(buf.length).toBe(2 * 4)
		expect(buf.toString('hex')).toBe('000005390000a455')
	})

	test('serializing record.record[i].record[j]', () => {
		const def = [
			{
				name: 'a',
				type: 'record',
				def: [
					{
						name: 'nesta',
						type: 'record[3]',
						def: [
							{
								name: 'nestb',
								type: 'record[2]',
								def: [{ name: 'value', type: 'uint32_be' }],
							},
						],
					},
				],
			},
		]
		const compiled = compile(def, { align: false })
		const buf = createRecord(compiled, {
			a: {
				nesta: [
					{
						nestb: [{ value: 1337 }, { value: 42069 }],
					},
					{
						nestb: [{ value: 1337 }, { value: 42069 }],
					},
					{
						nestb: [{ value: 1337 }, { value: 42069 }],
					},
				],
			},
		})

		expect(buf.length).toBe(3 * 2 * 4)
		expect(buf.toString('hex')).toBe(
			'000005390000a455000005390000a455000005390000a455'
		)
	})
})

describe("Test that it's possible to deserialize various kinds of arrays", () => {
	test('int8[1]', () => {
		const def = [{ name: 'a', type: 'int8[1]' }]
		const compiled = compile(def, { align: false })
		const buf = Buffer.from('01', 'hex')
		const obj = deserialize(compiled, buf)

		expect(obj).toEqual({ a: [1] })
	})

	test('int8[3]', () => {
		const def = [{ name: 'a', type: 'int8[3]' }]
		const compiled = compile(def, { align: false })
		const buf = Buffer.from('010101', 'hex')
		const obj = deserialize(compiled, buf)

		expect(obj).toEqual({ a: [1, 1, 1] })
	})

	test('deserializing cstring[2]', () => {
		const def = [{ name: 'a', type: 'cstring[2]', size: 10 }]
		const compiled = compile(def, { align: false })
		const buf = Buffer.from('hello\0\0\0\0\0world\0\0\0\0\0', 'utf8')
		const obj = deserialize(compiled, buf)

		expect(obj).toEqual({
			a: ['hello', 'world'],
		})
	})

	test('deserializing record[2]', () => {
		const def = [
			{
				name: 'a',
				type: 'record[2]',
				def: [{ name: 'value', type: 'uint32_be' }],
			},
		]
		const compiled = compile(def, { align: false })
		const buf = Buffer.from('000005390000a455', 'hex')
		const obj = deserialize(compiled, buf)

		expect(obj).toEqual({
			a: [{ value: 1337 }, { value: 42069 }],
		})
	})

	test('deserializing record[i].record', () => {
		const def = [
			{
				name: 'a',
				type: 'record[2]',
				def: [
					{
						name: 'nest',
						type: 'record',
						def: [{ name: 'value', type: 'uint32_be' }],
					},
				],
			},
		]
		const compiled = compile(def, { align: false })
		const buf = Buffer.from('000005390000a455', 'hex')
		const obj = deserialize(compiled, buf)

		expect(obj).toEqual({
			a: [{ nest: { value: 1337 } }, { nest: { value: 42069 } }],
		})
	})

	test('deserializing record.record[i]', () => {
		const def = [
			{
				name: 'a',
				type: 'record',
				def: [
					{
						name: 'nest',
						type: 'record[2]',
						def: [{ name: 'value', type: 'uint32_be' }],
					},
				],
			},
		]
		const compiled = compile(def, { align: false })
		const buf = Buffer.from('000005390000a455', 'hex')
		const obj = deserialize(compiled, buf)

		expect(obj).toEqual({
			a: { nest: [{ value: 1337 }, { value: 42069 }] },
		})
	})

	test('deserializing record.record[i].record', () => {
		const def = [
			{
				name: 'a',
				type: 'record',
				def: [
					{
						name: 'nesta',
						type: 'record[2]',
						def: [
							{
								name: 'nestb',
								type: 'record',
								def: [{ name: 'value', type: 'uint32_be' }],
							},
						],
					},
				],
			},
		]
		const compiled = compile(def, { align: false })
		const buf = Buffer.from('000005390000a455', 'hex')
		const obj = deserialize(compiled, buf)

		expect(obj).toEqual({
			a: {
				nesta: [
					{ nestb: { value: 1337 } },
					{ nestb: { value: 42069 } },
				],
			},
		})
	})

	test('deserializing record.record[i].record[j]', () => {
		const def = [
			{
				name: 'a',
				type: 'record',
				def: [
					{
						name: 'nesta',
						type: 'record[3]',
						def: [
							{
								name: 'nestb',
								type: 'record[2]',
								def: [{ name: 'value', type: 'uint32_be' }],
							},
						],
					},
				],
			},
		]
		const compiled = compile(def, { align: false })
		const buf = Buffer.from(
			'000005390000a455000005390000a455000005390000a455',
			'hex'
		)
		const obj = deserialize(compiled, buf)

		expect(obj).toEqual({
			a: {
				nesta: [
					{
						nestb: [{ value: 1337 }, { value: 42069 }],
					},
					{
						nestb: [{ value: 1337 }, { value: 42069 }],
					},
					{
						nestb: [{ value: 1337 }, { value: 42069 }],
					},
				],
			},
		})
	})
})

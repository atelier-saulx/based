import { compile, createRecord, readValue, readString, writeValue, deserializeRecordPArray } from '../src'

const subRecordDef = [{ name: 'value', type: 'uint32_le' }]
const recordDef = [
	{ name: 'a', type: 'uint32_le' },
	{ name: 'name', type: 'cstring', size: 15 },
	{ name: 'values', type: 'record_p' },
	{ name: 'more', type: 'cstring_p' },
]

Object.freeze(subRecordDef)
Object.freeze(recordDef)

describe('Test record pointers', () => {
	test('A simple record pointer', () => {
		const sub = compile(subRecordDef)
		const rec = compile(recordDef)
		const buf = createRecord(rec, {
			a: 42,
			name: 'Joe',
			values: createRecord(sub, { value: 1337 }),
			more: 'hello hello',
		})

		expect(readValue(rec, buf, '.a')).toBe(42)
		const subBuf = readValue<Buffer>(rec, buf, '.values')
		expect(subBuf).toBeTruthy()
		expect(readValue(sub, subBuf, '.value')).toBe(1337)
		expect(readString(rec, buf, '.more','utf-8')).toBe('hello hello')
	})

	test('Deserialize a record pointer', () => {
		const sub = compile(subRecordDef)
		const rec = compile(recordDef)
		const buf = createRecord(rec, {
			a: 42,
			name: 'Joe',
			values: createRecord(sub, { value: 1 }),
			more: 'hello hello',
		})

		expect(readValue(rec, buf, '.a')).toBe(42)

		const subs = deserializeRecordPArray(rec, buf, '.values', sub)
		expect(subs).toEqual([{ value: 1 }])

		expect(readString(rec, buf, '.more','utf-8')).toBe('hello hello')
	})

	test('An array of records', () => {
		const sub = compile(subRecordDef)
		const rec = compile(recordDef)
		const buf = createRecord(rec, {
			a: 42,
			name: 'Joe',
			values: [
				createRecord(sub, { value: 1 }),
				createRecord(sub, { value: 2 }),
				createRecord(sub, { value: 3 }),
				createRecord(sub, { value: 4 }),
			],
			more: 'hello hello',
		})

		expect(readValue(rec, buf, '.a')).toBe(42)

		const subs = deserializeRecordPArray(rec, buf, '.values', sub)
		expect(subs).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }])

		expect(readString(rec, buf, '.more','utf-8')).toBe('hello hello')
	})
})

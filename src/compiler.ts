import { ENDIANNESS, memalign_offset } from './memalign';
import { Char, TYPES, SIZES } from './types';

export interface RecordDef {
	name: string;
	type: string;
	size?: number;
	def?: RecordDef[];
}

export interface CompiledRecordDef {
	size: number;
	/**
	 * List of all fields in the record type.
	 * [offset, typeSize, arrSize, typeCode, path fullName, recordIndex ]
	 * arrSize = 0 = the field is not an array
	 */
	fieldList: [number, number, number, Char, string[], string][];
	fieldMap: { [index: string]: { offset: number; size: number; arrSize: number; type: Char; name: string } };
}

const makeName = (a: string, b: string) => `${a}.${b}`;

function _compile(recordDef: RecordDef[], parentName: string): [number, number, number, Char, string[], string][] {
	// @ts-ignore
	return recordDef
		.map(({ name, type: rawType, size, def }) => {
			const reMatch = rawType.match(/^([^\[\]]+)(?:\[(\d+)\])?$/);
			if (!reMatch) {
				throw new TypeError(`Invalid type: "${rawType}"`);
			}

			const type = reMatch[1];
			const arrSize = Number(reMatch[2] || 0);
			if (!Number.isInteger(arrSize)) {
				throw new TypeError('Array size must be an integer');
			}

			const typeCode = TYPES[type];
			if (!typeCode) {
				throw new TypeError(`Invalid type: "${rawType}"`);
			}

			if (type === 'record') {
				if (!def) {
					throw new TypeError('Incomplete record');
				}
				return arrSize > 0
					? Array(arrSize)
							.fill(null)
							.map((_, i) => _compile(def, makeName(parentName, `${name}[${i}]`)))
							.flat(1)
					: _compile(def, makeName(parentName, name));
			}

			size = SIZES[type] || size;
			if (!Number.isInteger(size)) {
				throw new Error(`Size must be set to an integer for type: "${rawType}"`);
			}

			// The final format will be [ offset, size, arrSize, type, name, path ]
			const fullName = makeName(parentName, name);
			return [[0, size, arrSize, typeCode, fullName.substring(1).split('.'), fullName]];
		})
		.flat(1);
}

export function compile(recordDef: RecordDef[], opts?: { align: boolean }): CompiledRecordDef {
	const align = opts?.align || false;
	const arr = _compile(recordDef, '');

	// Calculate the size of the whole Record without considering alignment yet
	// cur[1] = sizeof T
	// cur[2] = sizeof array || 0
	let recordSize = arr.reduce(
		(acc: number, field: [number, number, number, Char, string[], string]) => acc + field[1] * (field[2] || 1),
		0
	);

	// Calculate offsets
	let prevOffset = 0;
	for (const field of arr) {
		const size = field[1] * (field[2] || 1);
		const padding = align ? memalign_offset(prevOffset, size) : 0;

		if (padding > 0) {
			recordSize += padding;
		}

		field[0] = prevOffset + padding;
		prevOffset += size + padding;
	}

	const compiled: CompiledRecordDef = { size: recordSize, fieldList: [], fieldMap: {} };
	for (const [offset, size, arrSize, type, _path, name] of arr) {
		if (compiled.fieldMap[name]) {
			throw new Error(`"${name}" is already defined`);
		}
		compiled.fieldMap[name] = { offset, size, arrSize, type, name };
	}

	compiled.fieldList = arr;

	return compiled;
}

function refToFieldType(key: string, value: any, inner: number = 0): string {
	const type = typeof value;

	switch (type) {
		case 'boolean':
			return 'int8';
		case 'number':
			return ENDIANNESS === 'LE' ? 'double_le' : 'double_be';
		case 'string':
			return 'cstring';
		case 'object':
			if (Array.isArray(value)) {
				if (inner > 0) {
					throw new Error('Multidimensional arrays are not supported');
				}

				return `${refToFieldType(key, value, inner + 1)}[${value.length}]`;
			} else {
				return 'record';
			}
		default:
			throw new Error(`Unsupported type: "${key}": ${type}`);
	}
}

export function generateRecordDef(obj: any): RecordDef[] {
	const def: RecordDef[] = [];

	for (const key of Object.keys(obj)) {
		const value = obj[key];
		const jsType = typeof value;
		const type = refToFieldType(key, value);

		switch (jsType) {
			case 'string':
				def.push({ name: key, type: 'cstring', size: value.length });
				break;
			case 'object':
				if (Array.isArray(value)) {
					// RFE We expect that all members are of the same type
					def.push({ name: key, type, size: value.length });
				} else {
					def.push({ name: key, type: 'record', def: generateRecordDef(value) });
				}
				break;
			default:
				def.push({ name: key, type });
		}
	}

	return def;
}

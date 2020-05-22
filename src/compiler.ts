import { Char, TYPES, SIZES } from './types';

export interface RecordDef {
	name: string;
	type: string;
	size?: number;
	def?: RecordDef[];
}

export interface CompiledRecordDef {
	size: number;
	fieldList: ReturnType<typeof _compile>;
	fieldMap: { [index: string]: { offset: number; size: number; type: Char; name: string } };
}

const makeName = (a: string, b: string) => `${a}.${b}`;

function _compile(recordDef: RecordDef[], parentName: string): [number, number, Char, string][] {
	// @ts-ignore
	return recordDef
		.map(({ name, type, size, def }) => {
			const t = TYPES[type];
			size = SIZES[type] || size;

			if (!t) {
				throw new Error(`Invalid type: "${type}"`);
			}

			if (type === 'record') {
				if (!def) {
					throw new TypeError('Incomplete record');
				}
				return _compile(def, makeName(parentName, name));
			}

			if (!Number.isInteger(size)) {
				throw new Error(`Size must be set to an integer for type: "${type}"`);
			}

			// The final format will be [ offset, size, type, name ]
			return [[size, size, t, makeName(parentName, name)]];
		})
		.flat(1);
}

export function compile(recordDef: RecordDef[]): CompiledRecordDef {
	const arr = _compile(recordDef, '');
	const size = arr.reduce((acc: number, cur: [number, number, Char, string]) => acc + cur[0], 0);

	let prevOffset = 0;
	for (const field of arr) {
		const tmp = field[0];
		field[0] = prevOffset;
		prevOffset += tmp;
	}

	const compiled: CompiledRecordDef = { size, fieldList: arr, fieldMap: {} };
	for (const [offset, size, type, name] of arr) {
		if (compiled.fieldMap[name]) {
			throw new Error(`"${name}" is already defined`);
		}
		compiled.fieldMap[name] = { offset, size, type, name };
	}

	return compiled;
}

export function generateRecordDef(obj: any) {
	const def: RecordDef[] = [];

	for (const key of Object.keys(obj)) {
		const value = obj[key];
		const type = typeof value;

		switch (type) {
			case 'boolean':
				// TODO Do we want a more "real" boolean?
				def.push({ name: key, type: 'int8' });
				break;
			case 'number':
				def.push({ name: key, type: 'double_le' });
				break;
			case 'string':
				def.push({ name: key, type: 'string', size: value.length });
				break;
			case 'object':
				if (!Array.isArray(value)) {
					def.push({ name: key, type: 'record', def: generateRecordDef(value) });
					break;
				}
			default:
				throw new TypeError(`Type not supported: ${key}: ${type}`);
		}
	}

	return def;
}

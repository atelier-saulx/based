import { ENDIANNESS, WORD_SIZE } from './mach';

/**
 * Encodings accepted by Record read and write operations.
 */
export type Encoding =
	| 'ascii'
	| 'utf8'
	| 'utf-8'
	| 'utf16le'
	| 'ucs2'
	| 'ucs-2'
	| 'base64'
	| 'latin1'
	| 'binary'
	| 'hex'
	| undefined;

/**
 * A list of valid Field Type Codes.
 */
export type FieldTypeCode =
	| 'a'
	| 'b'
	| 'c'
	| 'd'
	| 'e'
	| 'f'
	| 'g'
	| 'h'
	| 'i'
	| 'j'
	| 'k'
	| 'l'
	| 'm'
	| 'n'
	| 'o'
	| 'p'
	| 'q'
	| 'r'
	| 's'
	| 't'
	| 'u'
	| 'v'
	| 'w'
	| 'z'
	| 'pw';

/**
 * A map from type names to Field Type Codes.
 */
export const TYPES: { [index: string]: FieldTypeCode } = {
	// Fixed size
	int8: 'a',
	int16: ENDIANNESS === 'BE' ? 'b' : 'c',
	int16_be: 'b',
	int16_le: 'c',
	int32: ENDIANNESS === 'BE' ? 'd' : 'e',
	int32_be: 'd',
	int32_le: 'e',
	int64: ENDIANNESS === 'BE' ? 'f' : 'g',
	int64_be: 'f',
	int64_le: 'g',
	uint8: 'h',
	uint16: ENDIANNESS === 'BE' ? 'i' : 'j',
	uint16_be: 'i',
	uint16_le: 'j',
	uint32: ENDIANNESS === 'BE' ? 'k' : 'l',
	uint32_be: 'k',
	uint32_le: 'l',
	uint64: ENDIANNESS === 'BE' ? 'm' : 'n',
	uint64_be: 'm',
	uint64_le: 'n',
	float: ENDIANNESS === 'BE' ? 'o' : 'p',
	float_be: 'o',
	float_le: 'p',
	double: ENDIANNESS === 'BE' ? 'q' : 'r',
	double_be: 'q',
	double_le: 'r',
	// Variable size
	int: ENDIANNESS === 'BE' ? 's' : 't',
	int_be: 's',
	int_le: 't',
	uint: ENDIANNESS === 'BE' ? 'u' : 'v',
	uint_be: 'u',
	uint_le: 'v',
	cstring: 'w',
	// Virtual
	record: 'z',
	// Pointer types
	cstring_p: 'pw',
};

export const TYPE_CODE2TYPE = new Map(Object.keys(TYPES).map((k) => [TYPES[k], k]));

/**
 * A map from type code to type size.
 */
export const SIZES: { [index: string]: number } = {
	a: 1, // int8
	b: 2, // int16_be
	c: 2, // int16_le
	d: 4, // int32_be
	e: 4, // int32_le
	f: 8, // int64_be
	g: 8, // int64_le
	h: 1, // uint8
	i: 2, // uint16_be
	j: 2, // uint16_le
	k: 4, // uint32_be
	l: 4, // uint32_le
	m: 8, // uint64_be
	n: 8, // uint64_le
	o: 4, // float_be
	p: 4, // float_le
	q: 8, // double_be
	r: 8, // double_le
	pw: 2 * WORD_SIZE, // cstring_p
};

/**
 * Returns a boolean true if the given Field Type Code is a variable type.
 */
export function isVarType(typeCode: FieldTypeCode): boolean {
	return ['s', 't', 'u', 'v', 'w'].includes(typeCode);
}

/**
 * Returns a boolean true if the given Field Type Code is a virtual type.
 */
export function isVirtualType(typeCode: FieldTypeCode): boolean {
	return typeCode === 'z';
}

/**
 * Returns a boolean true if the given Field Type Code is a pointer type.
 */
export function isPointerType(typeCode: FieldTypeCode): boolean {
	return typeCode === 'pw';
}

/**
 * Map Field Type Codes to C types.
 */
export const C_TYPES = {
	// Fixed size
	a: 'int8_t',
	b: 'int16_t',
	c: 'int16_t',
	d: 'int32_t',
	e: 'int32_t',
	f: 'int64_t',
	g: 'int64_t',
	h: 'uint8_t',
	i: 'uint16_t',
	j: 'uint16_t',
	k: 'uint32_t',
	l: 'uint32_t',
	m: 'uint64_t',
	n: 'uint64_t',
	o: 'float',
	p: 'float',
	q: 'double',
	r: 'double',
	// Variable size
	s: 'int8_t',
	t: 'int8_t',
	u: 'uint8_t',
	v: 'uint8_t',
	w: 'char',
	// Pointer types
	pw: 'char *',
};

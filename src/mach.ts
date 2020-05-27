import os from 'os';

type WordWidth = 4 | 8;

function getWW(): WordWidth {
	const arch = os.arch();

	switch (arch) {
		case 'arm':
		case 'ia32':
		case 'mips':
		case 'mipsel':
		case 'ppc':
		case 'x32':
			return 4;
		case 'arm64':
		case 'ppc64':
		case 'x64':
			return 8;
		case 's390':
		case 's390x':
		default:
			throw new Error(`Arch ${arch} not supported`);
	}
}

export const ENDIANNESS: 'LE' | 'BE' = os.endianness();
export const WORD_SIZE: WordWidth = getWW();
export const MACH_TYPE = `${ENDIANNESS}${WORD_SIZE}`;

const modAl = (x: number, y: number) => x & (y - 1);

/**
 * Returns a word aligned size.
 */
export function memalign_word(size: number): number {
	const padding = modAl(WORD_SIZE - modAl(size, WORD_SIZE), WORD_SIZE);

	return size + padding;
}

/**
 * Aligns size to a given multiple.
 */
export function memalign_size(size: number, bytes: number): number {
	const padding = modAl(bytes - modAl(size, bytes), bytes);

	return size + padding;
}

/**
 * Returns the required number of padding bytes.
 */
export function memalign_padding(offset: number, align: number): number {
	return -offset & (align - 1);
}

import os from 'os';

function getWW(): number {
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

const WORD_SIZE = getWW();
const modAl = (x: number, y: number) => x & (y - 1);

export const ENDIANNESS = os.endianness();

export function align_word(size: number) {
	const padding = modAl((WORD_SIZE - modAl(size, WORD_SIZE)), WORD_SIZE);

	return size + padding;
}

export function memalign_size(size: number,bytes: number) {
	const padding = modAl((bytes - modAl(size, bytes)), bytes);

	return size + padding;
}

export function memalign_offset(offset: number, align: number) {
	return (-offset & (align - 1));
}

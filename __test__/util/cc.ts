import { join as pathJoin } from 'path';
import { spawn } from 'child_process';
import { unlinkSync } from 'fs';
import tmp from 'tmp-promise';

export default class CC {
	#tmpFile: string = tmp.tmpNameSync({ tmpdir: __dirname, template: pathJoin(__dirname, `tmp-XXXXXX`) });

	async compile(source: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const cc = spawn('gcc', ['-xc', '-', '-o', this.#tmpFile]);

			cc.stdin.end(source);
			cc.stderr.on('data', (data: Buffer) => {
				const str = data.toString('utf8');

				if (!str.includes('#pragma')) {
					console.error(data.toString('utf8'));
				}
			});
			cc.on('close', (code) => {
				if (code !== 0) {
					return reject(`gcc failed with: ${code}`);
				}
				resolve();
			});
		});
	}

	run(): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			let out = '';

			const prg = spawn(this.#tmpFile);

			prg.stdout.on('data', (data: Buffer) => {
				out += data.toString('utf8');
			});
			prg.stderr.on('data', (data: Buffer) => {
				console.error(data.toString('utf8'));
			});
			prg.on('close', (code) => {
				if (code !== 0) {
					return reject('Failed');
				}
				resolve(Buffer.from(out, 'hex'));
			});
		});
	}

	clean() {
		try {
			unlinkSync(this.#tmpFile);
		} catch (err) {}
	}

};

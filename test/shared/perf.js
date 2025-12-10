import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { styleText } from 'util';
const MEASURES_PER_TEST = 10;
function writeAndReplace(text, lineEnd = '') {
    process.stdout.write('\r' + text);
    process.stdout.write(lineEnd);
}
export async function perf(fn, label, options = {}) {
    options.repeat ??= 1;
    options.timeout ??= 5000;
    options.silent ??= false;
    options.diffThreshold ??= 10;
    const testFileName = path.basename(process.env.TEST_FILENAME);
    const dbVersion = process.env.npm_package_version;
    const outputFile = options.outputFile ?? `perf_${testFileName}_${dbVersion}.json`;
    const outputDir = './tmp_perf_logs';
    const testFunction = process.env.TEST_NAME ?? 'not inside a test';
    const durations = [];
    let timeOut;
    try {
        for (let i = 0; i < options.repeat; i++) {
            const start = performance.now();
            clearTimeout(timeOut);
            await Promise.race([
                callWrapper(fn),
                new Promise((_, reject) => (timeOut = setTimeout(() => reject(new Error(`Timeout of ${options.timeout}ms exceeded`)), options.timeout))),
            ]);
            const end = performance.now();
            const duration = end - start;
            if (!options.silent) {
                if (options.repeat > 1) {
                    writeAndReplace(styleText('gray', `Running ${label} ${i + 1}/${options.repeat} in ${Math.round(duration)}ms`));
                }
            }
            durations.push(duration);
        }
        clearTimeout(timeOut);
        const totalTime = durations.reduce((a, b) => a + b, 0);
        const avgTime = totalTime / durations.length;
        const scriptName = process.env.npm_lifecycle_event || '';
        const isDebugMode = scriptName.includes('debug');
        const result = {
            timestamp: new Date().toISOString(),
            dbVersion: dbVersion,
            label,
            avgDurationMs: Number(avgTime.toFixed(4)),
            totalDurationMs: Number(totalTime.toFixed(4)),
            repetitions: options.repeat,
            isDebugMode: isDebugMode,
        };
        const diff = await saveResultToFile(path.join(outputDir, outputFile), testFunction, label, result);
        const percentDiff = diff.previous !== undefined ? (diff.difference / diff.previous) * 100 : 0;
        let diffMessage = styleText('gray', ` no previous found`);
        if (!isNaN(diff.difference)) {
            if (Math.abs(percentDiff) > options.diffThreshold) {
                diffMessage =
                    diff.difference >= 0
                        ? styleText('red', ` +${diff.difference.toFixed(2)} ms (${percentDiff.toFixed(1)}%)`)
                        : styleText('green', ` ${diff.difference.toFixed(2)} ms (${percentDiff.toFixed(1)}%)`);
            }
            else {
                diffMessage = styleText('gray', ` similar performance`);
            }
        }
        if (!options.silent) {
            writeAndReplace(styleText('gray', `${styleText('bold', styleText('white', label))} Avg ${avgTime.toFixed(2)}ms, Total ${totalTime.toFixed(2)}ms (${options.repeat}x)${diffMessage}`), '\n');
        }
        return totalTime;
    }
    catch (err) {
        console.error(`Error in perf run "${label}":`, err);
        return 0;
    }
}
perf.skip = async (fn, label, options = {}) => {
    console.log(`${styleText('gray', `skip perf "${label}"`)}`);
};
async function callWrapper(fn) {
    const result = fn();
    if (result && typeof result.then === 'function') {
        await result;
    }
}
async function saveResultToFile(filePath, testName, label, data) {
    const absolutePath = path.resolve(filePath);
    let fileContent = {};
    try {
        if (!(await fs.stat(path.dirname(filePath)).catch(() => { }))) {
            await fs.mkdir(path.dirname(filePath));
        }
        const content = await fs.readFile(absolutePath, 'utf-8');
        fileContent = JSON.parse(content);
    }
    catch (e) {
        fileContent = {};
    }
    if (!fileContent[testName]) {
        fileContent[testName] = [];
    }
    const previous = fileContent[testName]
        .filter((m) => m.label == label)
        .slice(-1)[0]?.totalDurationMs;
    const difference = data.totalDurationMs - previous;
    data.difference = difference;
    data.previous = previous;
    fileContent[testName].push(data);
    if (fileContent[testName].filter((m) => m.label == label).length >
        MEASURES_PER_TEST) {
        fileContent[testName] = fileContent[testName]
            .filter((m) => m.label == label)
            .slice(-MEASURES_PER_TEST);
    }
    await fs.writeFile(absolutePath, JSON.stringify(fileContent, null, 2));
    return { difference: difference, previous: previous };
}
//# sourceMappingURL=perf.js.map
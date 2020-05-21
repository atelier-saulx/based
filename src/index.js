// TODO packed fields

const SIZES = {
    int8: 1,
    int16_be: 2,
    int16_le: 2,
    int32_be: 4,
    int32_le: 4,
    int64_be: 8,
    int64_le: 8,
    uint8: 1,
    uint16_be: 2,
    uint16_le: 2,
    uint32_be: 4,
    uint32_le: 4,
    uint64_be: 8,
    uint64_le: 8,
    float_be: 4,
    float_le: 4,
    double_be: 8,
    double_le: 8,
};

const TYPES = {
    // Fixed size
    int8: 'a',
    int16_be: 'b',
    int16_le: 'c',
    int32_be: 'd',
    int32_le: 'e',
    int64_be: 'f',
    int64_le: 'g',
    uint8: 'h',
    uint16_be: 'i',
    uint16_le: 'j',
    uint32_be: 'k',
    uint32_le: 'l',
    uint64_be: 'm',
    uint64_le: 'n',
    float_be: 'o',
    float_le: 'p',
    double_be: 'q',
    double_le: 'r',
    // Variable size
    int_be: 's',
    int_le: 't',
    uint_be: 'u',
    uint_le: 'v',
    // Virtual
    record: 'z',
};

/**
 * Get read functions for a data-record buffer.
 * @param {Buffer} buf is a data-record buffer.
 */
function getReadFunc(buf) {
    return {
        a: (offset) => buf.readInt8(offset),
        b: (offset) => buf.readInt16BE(offset),
        c: (offset) => buf.readInt16LE(offset),
        d: (offset) => buf.readInt32BE(offset),
        e: (offset) => buf.readInt32LE(offset),
        f: (offset) => buf.readInt64BE(offset),
        g: (offset) => buf.readInt64LE(offset),
        h: (offset) => buf.readUInt8(offset),
        i: (offset) => buf.readUInt16BE(offset),
        j: (offset) => buf.readUInt16LE(offset),
        k: (offset) => buf.readUInt32BE(offset),
        l: (offset) => buf.readUInt32LE(offset),
        m: (offset) => buf.readUInt64BE(offset),
        n: (offset) => buf.readUInt64LE(offset),
        o: (offset) => buf.readFloatBE(offset),
        p: (offset) => buf.readFloatLE(offset),
        q: (offset) => buf.readDoubleBE(offset),
        r: (offset) => buf.readDoubleLE(offset),
        s: (offset, len) => buf.readIntBE(offset, len),
        t: (offset, len) => buf.readIntLE(offset, len),
        u: (offset, len) => buf.readUIntBE(offset, len),
        v: (offset, len) => buf.readUIntLE(offset, len),
    };
}

/**
 * Get write functions for a data-record buffer.
 * @param {Buffer} buf is a data-record buffer.
 */
function getWriteFunc(buf) {
    return {
        a: (v, offset) => buf.writeInt8(v, offset),
        b: (v, offset) => buf.writeInt16BE(v, offset),
        c: (v, offset) => buf.writeInt16LE(v, offset),
        d: (v, offset) => buf.writeInt32BE(v, offset),
        e: (v, offset) => buf.writeInt32LE(v, offset),
        f: (v, offset) => buf.writeInt64BE(v, offset),
        g: (v, offset) => buf.writeInt64LE(v, offset),
        h: (v, offset) => buf.writeUInt8(v, offset),
        i: (v, offset) => buf.writeUInt16BE(v, offset),
        j: (v, offset) => buf.writeUInt16LE(v, offset),
        k: (v, offset) => buf.writeUInt32BE(v, offset),
        l: (v, offset) => buf.writeUInt32LE(v, offset),
        m: (v, offset) => buf.writeUInt64BE(v, offset),
        n: (v, offset) => buf.writeUInt64LE(v, offset),
        o: (v, offset) => buf.writeFloatBE(v, offset),
        p: (v, offset) => buf.writeFloatLE(v, offset),
        q: (v, offset) => buf.writeDoubleBE(v, offset),
        r: (v, offset) => buf.writeDoubleLE(v, offset),
        s: (v, offset, len) => buf.writeIntBE(v, offset, len),
        t: (v, offset, len) => buf.writeIntLE(v, offset, len),
        u: (v, offset, len) => buf.writeUIntBE(v, offset, len),
        v: (v, offset, len) => buf.writeUIntLE(v, offset, len),
    };
}

const makeName = (a, b) => `${a}.${b}`;

function _compile(recordDef, parentName) {
    return recordDef.map(({name, type, size, def}) => {
        const t = TYPES[type];
        size = SIZES[type] || size;

        if (!t) {
            throw new Error(`Invalid type: "${type}"`);
        }

        if (type === 'record') {
            return _compile(def, makeName(parentName, name));
        }

        if (!Number.isInteger(size)) {
            throw new Error(`Size must be set to an integer for type: "${type}"`);
        }

        // The final format will be [ offset, size, type, name ]
        return [[ size, size, t, makeName(parentName, name) ]];
    }).flat(1);
}

export function compile(recordDef) {
    const arr = _compile(recordDef, '');
    const size = arr.reduce((acc, cur) => acc + cur[0], 0);

    let prevOffset = 0;
    for (const field of arr) {
        const tmp = field[0];
        field[0] = prevOffset;
        prevOffset += tmp;
    }

    const compiled = { size, fieldList: arr, fieldMap: {} };
    for (const [offset, size, type, name] of arr) {
        if (compiled.fieldMap[name]) {
            throw new Error(`"${name}" is already defined`);
        }
        compiled.fieldMap[name] = { offset, size, type, name };
    }

    return compiled;
}

export function allocRecord(compiledDef) {
    const buf = Buffer.alloc(compiledDef.size);

    return buf;
}

export function fillRecord(buf, compiledDef, obj) {
    const ops = getWriteFunc(buf);

    for (const [offset, size, type, path] of compiledDef.fieldList) {
        const names = path.substring(1).split('.');

        let cur = obj;
        for (const name of names) {
            cur = cur[name];
        }

        try {
            ops[type](cur, offset, size);
        } catch (err) {
            err.name = path;
            throw err;
        }
    }
}

export function createRecord(compiledDef, obj) {
    const buf = allocRecord(compiledDef);
    fillRecord(buf, compiledDef, obj);

    return buf;
}

export function getValue(buf, compiledDef, path) {
    const funcs = getReadFunc(buf);
    const {offset, size, type} = compiledDef.fieldMap[path] || {};

    if (!offset) {
        throw new Error('Not found');
    }

    return funcs[type](offset, size);
}

export function setValue(buf, compiledDef, path, value) {
    const funcs = getWriteFunc(buf);
    const {offset, size, type} = compiledDef.fieldMap[path] || {};

    if (!offset) {
        throw new Error('Not found');
    }

    funcs[type](value, offset, size);
}

export function createReader(buf, compiledDef, path) {
    const funcs = getReadFunc(buf);
    const {offset, size, type} = compiledDef.fieldMap[path] || {};

    if (!offset) {
        throw new Error('Not found');
    }

    return () => funcs[type](offset, size);
}

export function createWriter(buf, compiledDef, path) {
    const funcs = getWriteFunc(buf);
    const {offset, size, type} = compiledDef.fieldMap[path] || {};

    if (!offset) {
        throw new Error('Not found');
    }

    return (value) => funcs[type](value, offset, size);
}

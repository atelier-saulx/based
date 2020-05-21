// TODO packed fields

const TYPES = {
    int32_t: 'a',
    uint32_t: 'b',
    record: 'r',
};

const SIZES = {
    int32_t: 4,
    uint32_t: 4,
};

function getReadFunc(buf) {
    return {
        a: (offset) => buf.readInt32LE(offset),
        b: (offset) => buf.readUInt32LE(offset),
    };
}

function getWriteFunc(buf) {
    return {
        a: (v, offset) => buf.writeInt32LE(v, offset),
        b: (v, offset) => buf.writeUInt32LE(v, offset),
    };
}

const makeName = (a, b) => `${a}.${b}`;

function _compile(recordDef, parentName) {
    const arr = recordDef.map(({name, type, def}) => {
        if (type === 'record') {
            return _compile(def, makeName(parentName, name));
        }

        return [[ SIZES[type], TYPES[type], makeName(parentName, name) ]];
    });

    return arr.flat(1);
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

    arr.unshift(size);

    return arr;
}

export function allocRecord(compiledDef) {
    const buf = Buffer.alloc(compiledDef[0]);

    return buf;
}

export function fillRecord(buf, compiledDef, obj) {
    const ops = getWriteFunc(buf);

    for (let i = 1; i < compiledDef.length; i++) {
        const [offset, type, path] = compiledDef[i];
        const names = path.substring(1).split('.');

        let cur = obj;
        for (const name of names) {
            cur = cur[name];
        }

        try {
            ops[type](cur, offset);
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

export function setValue(buf, compiledDef, path, value) {
    for (let i = 1; i < compiledDef.length; i++) {
        const [offset, type, defPath] = compiledDef[i];
        if (path === defPath) {
            const funcs = getWriteFunc(buf);
            funcs[type](value, offset);
            break;
        }
    }
}

export function getValue(buf, compiledDef, path) {
    for (let i = 1; i < compiledDef.length; i++) {
        const [offset, type, defPath] = compiledDef[i];
        if (path === defPath) {
            const funcs = getReadFunc(buf);
            return funcs[type](offset);
        }
    }

    return null;
}

export function createReader(buf, compiledDef, path) {
    for (let i = 1; i < compiledDef.length; i++) {
        const [offset, type, defPath] = compiledDef[i];
        if (path === defPath) {
            const funcs = getReadFunc(buf);
            return () => funcs[type](offset);
        }
    }

    return null;
}

export function createWriter(buf, compiledDef, path) {
    for (let i = 1; i < compiledDef.length; i++) {
        const [offset, type, defPath] = compiledDef[i];
        if (path === defPath) {
            const funcs = getWriteFunc(buf);
            return (value) => funcs[type](value, offset);
        }
    }

    return null;
}

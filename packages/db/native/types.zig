// TODO: lower case this is the zig way
// https://zig.guide/language-basics/enums/

pub const Prop = enum(u8) {
    NULL = 0,
    TIMESTAMP = 1,
    CREATED = 2,
    UPDATED = 3,
    NUMBER = 4,
    CARDINALITY = 5,
    INT8 = 20,
    UINT8 = 6,
    INT16 = 21,
    UINT16 = 22,
    INT32 = 23,
    UINT32 = 7,
    BOOLEAN = 9,
    ENUM = 10,
    STRING = 11,
    TEXT = 12,
    REFERENCE = 13,
    REFERENCES = 14,
    WEAK_REFERENCE = 15,
    WEAK_REFERENCES = 16,
    MICRO_BUFFER = 17,
    ALIAS = 18,
    ALIASES = 19,
    BINARY = 25,
    ID = 26,
    VECTOR = 27,
    JSON = 28,
    pub fn isBuffer(self: Prop) bool {
        return switch (self) {
            Prop.BINARY,
            Prop.ALIAS,
            Prop.STRING,
            => true,
            else => false,
        };
    }
    pub fn isSigned(self: Prop) bool {
        return switch (self) {
            Prop.INT16,
            Prop.INT32,
            Prop.TIMESTAMP,
            Prop.CREATED,
            Prop.UPDATED,
            => true,
            else => false,
        };
    }
    pub fn isNumber(self: Prop) bool {
        return switch (self) {
            Prop.NUMBER,
            Prop.INT8,
            Prop.UINT8,
            Prop.UINT16,
            Prop.INT16,
            Prop.UINT32,
            Prop.INT32,
            Prop.CARDINALITY,
            => true,
            else => false,
        };
    }
};

pub fn Size(p: Prop) u8 {
    switch (p) {
        Prop.TIMESTAMP,
        Prop.CREATED,
        Prop.UPDATED,
        Prop.NUMBER,
        => {
            return 8;
        },
        Prop.INT8, Prop.UINT8, Prop.BOOLEAN, Prop.ENUM => {
            return 1;
        },
        Prop.ID, Prop.UINT32, Prop.INT32 => {
            return 4;
        },
        Prop.INT16, Prop.UINT16 => {
            return 2;
        },
        else => {
            return 0;
        },
    }
}

pub const RefOp = enum(u8) {
    OVERWRITE = 0,
    ADD = 1,
    DELETE = 2,
    PUT_OVERWRITE = 3,
    PUT_ADD = 4,
    _,
};

pub const RefEdgeOp = enum(u8) {
    noEdgeNoIndexRealId = 0,
    edgeNoIndexRealId = 1,
    edgeIndexRealId = 2,
    noEdgeIndexRealId = 3,
    noEdgeNoIndexTmpId = 4,
    edgeNoIndexTmpId = 5,
    edgeIndexTmpId = 6,
    noEdgeIndexTmpId = 7,
    _,
    pub fn hasEdges(self: RefEdgeOp) bool {
        return switch (self) {
            RefEdgeOp.edgeIndexRealId,
            RefEdgeOp.edgeNoIndexRealId,
            RefEdgeOp.edgeNoIndexTmpId,
            RefEdgeOp.edgeIndexTmpId,
            => true,
            else => false,
        };
    }
    pub fn isTmpId(self: RefEdgeOp) bool {
        return switch (self) {
            RefEdgeOp.noEdgeNoIndexTmpId,
            RefEdgeOp.edgeNoIndexTmpId,
            RefEdgeOp.edgeIndexTmpId,
            RefEdgeOp.noEdgeIndexTmpId,
            => true,
            else => false,
        };
    }
    pub fn hasIndex(self: RefEdgeOp) bool {
        return switch (self) {
            RefEdgeOp.edgeIndexRealId,
            RefEdgeOp.noEdgeIndexRealId,
            RefEdgeOp.edgeIndexTmpId,
            RefEdgeOp.noEdgeIndexTmpId,
            => true,
            else => false,
        };
    }
};

pub const ModOp = enum(u8) {
    SWITCH_FIELD = 0,
    DELETE_NODE = 10,
    CREATE_OR_GET = 9,
    SWITCH_NODE = 1,
    SWITCH_TYPE = 2,
    CREATE_PROP = 3,
    UPDATE_PARTIAL = 5,
    UPDATE_PROP = 6,
    ADD_EMPTY_SORT = 7,
    DELETE = 11,
    DELETE_SORT_INDEX = 4,
    INCREMENT = 12,
    DECREMENT = 13,
    EXPIRE = 14,
    ADD_EMPTY_SORT_TEXT = 15,
    DELETE_TEXT_FIELD = 16,
    _,
};

pub const LangCode = enum(u8) { NONE = 0, _ };

pub const MAIN_PROP: u8 = 0;

pub const ReadOp = enum(u8) {
    NONE = 0,
    ID = 255,
    EDGE = 252,
    REFERENCES = 253,
    REFERENCE = 254,
    REFERENCES_AGGREGATION = 250,
};

pub const IncludeOp = enum(u8) {
    referencesAggregation = 251, // use this
    edge = 252,
    references = 254,
    reference = 255,
    _,
};

pub const ReadRefOp = enum(u8) {
    REFERENCES = @intFromEnum(ReadOp.REFERENCES),
    REFERENCE = @intFromEnum(ReadOp.REFERENCE),
    none = @intFromEnum(ReadOp.NONE),
};

pub const ResultType = enum(u8) {
    none = 0,
    references = 1,
    reference = 2,
    edge = 3,
    referencesEdge = 4,
    referenceEdge = 5,
    aggregate = 6,
    // here we get agg
};

pub const AggFn = enum(u8) {
    none = 0,
    avg = 1,
    cardinality = 2,
    concat = 3, // string aggregation, delimiter should be an argument
    count = 4,
    max = 5,
    min = 6,
    mode = 7, // ordered-set
    percentile = 8, // continuous or discrete should be optional parameters, default = discrete
    rank = 9, // hypothetical-set, dense should be optional parameter
    stddev = 10, // population or sample should be optional parameters, default = sample
    sum = 11,
    variance = 12,
};

pub const Compression = enum(u8) {
    none = 0,
    compressed = 1,
};

pub const QueryType = enum(u8) {
    id = 0,
    ids = 1,
    default = 2,
    alias = 3,
    aggregates = 4,
    aggregatesCountType = 5,
};

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
    INT64 = 24,
    UINT64 = 8,
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
            Prop.INT64,
            Prop.TIMESTAMP,
            Prop.CREATED,
            Prop.UPDATED,
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
        Prop.UINT64,
        Prop.INT64,
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
            return 4;
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
    DELETE_PROP_ONLY = 8,
    DELETE_PROP_ONLY_REAL = 11,
    DELETE_PROP = 4,
    INCREMENT = 12,
    DECREMENT = 13,
    EXPIRE = 14,
    ADD_EMPTY_SORT_TEXT = 15,
    _,
};

pub const LangCode = enum(u8) { NONE = 0, _ };

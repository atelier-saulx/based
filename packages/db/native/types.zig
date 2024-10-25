pub const Prop = enum(u8) {
    NULL = 0,
    TIMESTAMP = 1,
    CREATED = 2,
    UPDATED = 3,
    NUMBER = 4,
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
};

pub fn Size(p: Prop) u8 {
    switch (p) {
        Prop.TIMESTAMP, Prop.CREATED, Prop.UPDATED, Prop.NUMBER => {
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

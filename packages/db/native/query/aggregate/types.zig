pub const GroupedBy = enum(u8) {
    hasGroup = 255,
    none = 0,
};

pub const AggType = enum(u8) { SUM = 1, COUNT = 2, _ };

pub const IsId = 255;

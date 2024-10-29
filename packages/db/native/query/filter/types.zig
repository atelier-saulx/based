pub const Operator = enum(u8) {
    equal = 1,
    has = 2,
    notEqual = 3,
    endsWith = 4,
    startsWith = 5,
    largerThen = 6,
    smallerThen = 7,
    largerThenInclusive = 8,
    smallerThenInclusive = 9,
    range = 10,
    rangeExclude = 11,
    equalNormalize = 12,
    hasNormalize = 13,
    startsWithNormalize = 14,
    endsWithNormalize = 15,
    pub fn isNumerical(self: Operator) bool {
        return switch (self) {
            Operator.smallerThen,
            Operator.largerThen,
            Operator.largerThenInclusive,
            Operator.smallerThenInclusive,
            Operator.range,
            Operator.rangeExclude,
            => true,
            else => false,
        };
    }
};

pub const Mode = enum(u8) {
    default = 0,
    orFixed = 1,
    orVar = 2,
    andFixed = 3,
};

pub const Meta = enum(u8) {
    edge = 252,
    reference = 254,
    _,
};

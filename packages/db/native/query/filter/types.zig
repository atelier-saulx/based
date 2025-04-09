const std = @import("std");

pub const Operator = enum(u8) {
    equal = 1,
    has = 2,
    endsWith = 4,
    startsWith = 5,
    largerThen = 6,
    smallerThen = 7,
    largerThenInclusive = 8,
    smallerThenInclusive = 9,
    equalNormalize = 12,
    hasLowerCase = 13,
    startsWithNormalize = 14,
    endsWithNormalize = 15,
    equalCrc32 = 17,
    like = 18,
    pub fn isNumerical(self: Operator) bool {
        return switch (self) {
            Operator.smallerThen,
            Operator.largerThen,
            Operator.largerThenInclusive,
            Operator.smallerThenInclusive,
            => true,
            else => false,
        };
    }
};

pub const Type = enum(u8) {
    negate = 1,
    default = 2,
};

pub const Mode = enum(u8) {
    default = 0,
    orFixed = 1,
    orVar = 2,
    andFixed = 3,
    defaultVar = 4,
    reference = 5,
};

pub const Meta = enum(u8) {
    exists = 251,
    edge = 252,
    orBranch = 253,
    reference = 254,
    id = 255,
    _,
};

pub const VectorFn = enum(u8) {
    dotProduct = 0,
    manhattanDistance = 1,
    cosineSimilarity = 2,
    euclideanDistance = 3,
};

pub const MaxVectorScore: f32 = 9999999;

pub const MaxStringScore: u8 = 255;

pub const ConditionsResult = std.meta.Tuple(&.{ usize, bool });

pub const Alignment = enum(u8) { notSet = 255, _ };

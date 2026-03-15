const t = @import("../../../types.zig");
const utils = @import("../../../utils.zig");
const std = @import("std");
const Fields = @import("../../../selva/fields.zig");

const Type = enum(u8) {
    default = 0,
    localized = 2,
};

inline fn localized(
    q: []const u8,
    v: []const u8,
    i: usize,
    c: *t.FilterCondition,
    compare: anytype,
) bool {
    if (c.lang == t.LangCode.none) {
        var iter = Fields.textIterator(@constCast(v));
        while (iter.next()) |value| {
            if (compare(.default, q, value, i, c)) {
                return true;
            }
        }
        return false;
    } else {
        return compare(.default, q, Fields.textFromValue(@constCast(v), c.lang), i, c);
    }
}

pub fn eqCrc32(
    comptime T: Type,
    q: []const u8,
    v: []const u8,
    i: usize,
    c: *t.FilterCondition,
) bool {
    if (T == .localized) {
        return localized(q, v, i, c, eqCrc32);
    }

    if (v.len == 0) {
        return false;
    } else if (v[1] == 1) {
        if (utils.readPtr(u32, q, i + 4 + @alignOf(u32) - c.offset).* != utils.read(u32, v, 2)) {
            return false;
        }
    } else {
        if (utils.readPtr(u32, q, i + 4 + @alignOf(u32) - c.offset).* != v.len - 6) {
            return false;
        }
    }

    if (utils.read(u32, v, v.len - 4) != utils.readPtr(u32, q, i + @alignOf(u32) - c.offset).*) {
        return false;
    }

    return true;
}

inline fn pack(high: u32, low: u32) u64 {
    return (@as(u64, high) << 32) | @as(u64, low);
}

pub fn eqCrc32Batch(
    T: Type,
    q: []const u8,
    v: []const u8,
    i: usize,
    c: *t.FilterCondition,
) bool {
    if (T == .localized) {
        return localized(q, v, i, c, eqCrc32Batch);
    }

    var value: u64 = undefined;

    if (v.len == 0) {
        return false;
    } else if (v[1] == 1) {
        value = pack(utils.read(u32, v, v.len - 4), utils.read(u32, v, 2));
    } else {
        value = pack(utils.read(u32, v, v.len - 4), @truncate(v.len - 6));
    }

    const size = utils.sizeOf(u64);
    const vectorLen = 16 / size;
    const values = utils.toSlice(u64, @constCast(q[i + size - c.offset .. i + c.size + @alignOf(u64) - c.offset]));
    const len = values.len;

    var j: usize = 0;
    while (j < len - vectorLen) : (j += vectorLen) {
        const vec2: @Vector(vectorLen, u64) = values[j..][0..vectorLen].*;
        if (std.simd.countElementsWithValue(vec2, value) != 0) {
            return true;
        }
    }

    return false;
}

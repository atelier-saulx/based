const default = @import("./default.zig").default;
const loose = @import("./loose.zig").loose;
const like = @import("./like.zig");
const t = @import("../types.zig");
const Op = t.Operator;
const Prop = @import("../../../types.zig").Prop;
const compressed = @import("../compressed.zig");
const read = @import("../../../utils.zig").read;
const decompress = compressed.decompress;
const Compare = compressed.Compare;
const db = @import("../../../db/db.zig");
const std = @import("std");
const toSlice = @import("../../../utils.zig").toSlice;
const Compression = @import("../../../types.zig").Compression;

inline fn orCompare(comptime isOr: bool, compare: Compare(void)) type {
    if (isOr) {
        return struct {
            pub fn func(value: []u8, query: []u8) bool {
                var j: usize = 0;
                while (j < query.len) {
                    const size = read(u16, query, j);
                    if (compare(value, query[j + 2 .. j + 2 + size])) {
                        return true;
                    }
                    j += size + 2;
                }
                return false;
            }
        };
    }
    return struct {
        pub fn func(value: []u8, query: []u8) bool {
            return compare(value, query);
        }
    };
}

inline fn hasInner(
    comptime isOr: bool,
    compare: Compare(void),
    mainLen: u16,
    prop: Prop,
    value: []u8,
    query: []u8,
) bool {
    if (prop == Prop.VECTOR) {
        const vecAligned = read([]f32, value, 0);
        return like.vector(vecAligned, query);
    } else if ((prop == Prop.STRING or prop == Prop.TEXT) and mainLen == 0) {
        if (value[1] == @intFromEnum(Compression.compressed)) {
            std.debug.print("yo \n", .{});
            if (!decompress(void, orCompare(isOr, compare).func, query, value, undefined)) {
                return false;
            }
        } else if (!orCompare(isOr, compare).func(value[1..value.len], query)) {
            return false;
        }
    } else if (!orCompare(isOr, compare).func(value, query)) {
        return false;
    }
    return true;
}

pub inline fn has(
    comptime isOr: bool,
    op: Op,
    prop: Prop,
    value: []u8,
    query: []u8,
    mainLen: u16,
) bool {
    if (op == Op.like) {
        return hasInner(isOr, like.str, mainLen, prop, value, query);
    } else if (op == Op.has) {
        return hasInner(isOr, default, mainLen, prop, value, query);
    } else if (op == Op.hasLowerCase) {
        return hasInner(isOr, loose, mainLen, prop, value, query);
    }
    return false;
}

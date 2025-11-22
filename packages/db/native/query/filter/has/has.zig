const std = @import("std");
const default = @import("./default.zig").default;
const loose = @import("./loose.zig").loose;
const like = @import("./like.zig");
const compressed = @import("../compressed.zig");
const read = @import("../../../utils.zig").read;
const db = @import("../../../db/db.zig");
const toSlice = @import("../../../utils.zig").toSlice;
const Compression = @import("../../../types.zig").Compression;
const deflate = @import("../../../deflate.zig");
const t = @import("../../../types.zig");

const decompress = compressed.decompress;
const Compare = compressed.Compare;

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
    decompressor: *deflate.Decompressor,
    blockState: *deflate.BlockState,
    comptime isOr: bool,
    compare: Compare(void),
    mainLen: u16,
    prop: t.PropType,
    value: []u8,
    query: []u8,
) bool {
    if (prop == t.PropType.vector) {
        const vecAligned = read([]f32, value, 0);
        return like.vector(vecAligned, query);
    } else if ((prop == t.PropType.string or prop == t.PropType.text) and mainLen == 0) {
        if (value[1] == @intFromEnum(Compression.compressed)) {
            if (!decompress(decompressor, blockState, void, orCompare(isOr, compare).func, query, value, undefined)) {
                return false;
            }
        } else if (!orCompare(isOr, compare).func(value[2 .. value.len - 4], query)) {
            return false;
        }
    } else if (!orCompare(isOr, compare).func(value, query)) {
        return false;
    }
    return true;
}

pub inline fn has(
    decompressor: *deflate.Decompressor,
    blockState: *deflate.BlockState,
    comptime isOr: bool,
    op: t.FilterOp,
    prop: t.PropType,
    value: []u8,
    query: []u8,
    mainLen: u16,
) bool {
    if (op == t.FilterOp.like) {
        return hasInner(decompressor, blockState, isOr, like.str, mainLen, prop, value, query);
    } else if (op == t.FilterOp.has) {
        return hasInner(decompressor, blockState, isOr, default, mainLen, prop, value, query);
    } else if (op == t.FilterOp.hasLowerCase) {
        return hasInner(decompressor, blockState, isOr, loose, mainLen, prop, value, query);
    }
    return false;
}

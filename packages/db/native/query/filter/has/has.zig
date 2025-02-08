const default = @import("./default.zig").default;
const loose = @import("./loose.zig").loose;
const like = @import("./like.zig").like;

const t = @import("../types.zig");
const Op = t.Operator;
const Prop = @import("../../../types.zig").Prop;
const compressed = @import("../compressed.zig");
const readInt = @import("../../../utils.zig").readInt;
const decompress = compressed.decompress;
const Compare = compressed.Compare;
const db = @import("../../../db/db.zig");
const std = @import("std");

inline fn orCompare(comptime isOr: bool, compare: Compare(void)) type {
    if (isOr) {
        return struct {
            pub fn func(value: []u8, query: []u8) bool {
                var j: usize = 0;
                while (j < query.len) {
                    const size = readInt(u16, query, j);
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
    dbCtx: *db.DbCtx,
) bool {
    var q = query;
    if ((prop == Prop.STRING or prop == Prop.TEXT) and mainLen == 0) {
        if (prop == Prop.TEXT) {
            q = query[0 .. query.len - 1];
        }

        if (value[1] == 1) {
            if (!decompress(void, orCompare(isOr, compare).func, q, value, dbCtx, undefined)) {
                return false;
            }
        } else if (!orCompare(isOr, compare).func(value[1..value.len], q)) {
            return false;
        }
    } else if (!orCompare(isOr, compare).func(value, q)) {
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
    dbCtx: *db.DbCtx,
) bool {
    if (op == Op.like) {
        return hasInner(isOr, like, mainLen, prop, value, query, dbCtx);
    } else if (op == Op.has) {
        return hasInner(isOr, default, mainLen, prop, value, query, dbCtx);
    } else {
        return hasInner(isOr, loose, mainLen, prop, value, query, dbCtx);
    }
    return false;
}

const default = @import("./default.zig").default;
const loose = @import("./loose.zig").loose;
const t = @import("../types.zig");
const Op = t.Operator;
const Prop = @import("../../../types.zig").Prop;
const compressed = @import("../compressed.zig");
const readInt = @import("../../../utils.zig").readInt;
const decompress = compressed.decompress;
const Compare = compressed.Compare;

inline fn orCompare(comptime isOr: bool, compare: Compare) type {
    if (isOr) {
        return struct {
            pub inline fn func(value: []const u8, query: []const u8) bool {
                var j: usize = 0;
                while (j < query.len) {
                    const size = readInt(u16, query, j);
                    if (compare(value, query[j + 2 .. j + size])) {
                        return true;
                    }
                    j += size + 2;
                }
                return false;
            }
        };
    }
    return struct {
        pub inline fn func(value: []const u8, query: []const u8) bool {
            return compare(value, query);
        }
    };
}

inline fn hasInner(
    comptime isOr: bool,
    compare: Compare,
    mainLen: u16,
    prop: Prop,
    value: []const u8,
    query: []const u8,
) bool {
    if (prop == Prop.STRING and mainLen == 0) {
        if (value[0] == 1) {
            if (!decompress(orCompare(isOr, compare).func, query, value)) {
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
    value: []const u8,
    query: []const u8,
    mainLen: u16,
) bool {
    if (op == Op.has) {
        return hasInner(isOr, default, mainLen, prop, value, query);
    } else {
        return hasInner(isOr, loose, mainLen, prop, value, query);
    }
    return false;
}

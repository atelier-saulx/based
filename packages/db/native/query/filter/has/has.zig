const default = @import("./default.zig").default;
const loose = @import("./loose.zig").loose;
const t = @import("../types.zig");
const Op = t.Operator;
const Prop = @import("../../../types.zig").Prop;
const compressed = @import("../compressed.zig");

inline fn hasInner(compare: compressed.Compare, mainLen: u16, prop: Prop, value: []u8, query: []u8) bool {
    if (prop == Prop.STRING and mainLen == 0) {
        if (value[0] == 1) {
            if (!compressed.decompress(compare, query, value)) {
                return false;
            }
        } else if (!compare(value[1..value.len], query)) {
            return false;
        }
    } else if (!compare(value, query)) {
        return false;
    }
    return true;
}

pub inline fn has(comptime _: bool, op: Op, prop: Prop, value: []u8, query: []u8, mainLen: u16) bool {
    if (op == Op.has) {
        return hasInner(default, mainLen, prop, value, query);
    } else {
        return hasInner(loose, mainLen, prop, value, query);
    }
    return false;
}

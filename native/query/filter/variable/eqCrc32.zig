const t = @import("../../../types.zig");
const utils = @import("../../../utils.zig");

pub fn eqCrc32(
    q: []u8,
    v: []const u8,
    i: usize,
    c: *t.FilterCondition,
) bool {
    if (v.len == 0) {
        return false;
    }
    if (v[1] == 1) {
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

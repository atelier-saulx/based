const readInt = @import("../../utils.zig").readInt;
const selva = @import("../../selva.zig");
const Prop = @import("../../types.zig").Prop;
const db = @import("../../db//db.zig");
const std = @import("std");

pub inline fn crc32Equal(
    prop: Prop,
    query: []u8,
    v: []u8,
) bool {
    const origLen = readInt(u32, query, 4);
    var valueLen: usize = undefined;
    if (prop == Prop.STRING and v[1] == 1) {
        valueLen = readInt(u32, v, 1); // is this correct?
    } else {
        valueLen = v.len - 6;
    }
    if (origLen != valueLen) {
        return false;
    }
    const crc32: u32 = readInt(u32, v, v.len - 4);
    const qCrc32 = readInt(u32, query, 0);
    if (crc32 != qCrc32) {
        return false;
    }
    return true;
}

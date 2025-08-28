const read = @import("../../utils.zig").read;
const selva = @import("../../selva.zig");
const Prop = @import("../../types.zig").Prop;
const db = @import("../../db//db.zig");
const std = @import("std");

pub inline fn crc32Equal(
    prop: Prop,
    query: []u8,
    v: []u8,
) bool {
    const origLen = read(u32, query, 4);
    var valueLen: usize = undefined;
    if (prop == Prop.STRING and v[1] == 1) {
        valueLen = read(u32, v, 2);
    } else {
        valueLen = v.len - 6;
    }
    if (origLen != valueLen) {
        return false;
    }
    const crc32: u32 = read(u32, v, v.len - 4);
    const qCrc32 = read(u32, query, 0);
    if (crc32 != qCrc32) {
        return false;
    }
    return true;
}

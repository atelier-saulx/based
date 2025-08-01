const std = @import("std");
const types = @import("../../types.zig");
const utils = @import("../../utils.zig");
const read = utils.read;
const selva = @import("../../selva.zig");

pub inline fn microbufferToF64(propType: types.Prop, buffer: []u8, offset: usize) f64 {
    return switch (propType) {
        types.Prop.UINT8 => @as(f64, @floatFromInt(buffer[offset])),
        types.Prop.INT8 => @as(f64, @floatFromInt(buffer[offset])),
        types.Prop.UINT16 => @as(f64, @floatFromInt(read(u16, buffer, offset))),
        types.Prop.INT16 => @as(f64, @floatFromInt(read(i16, buffer, offset))),
        types.Prop.UINT32 => @as(f64, @floatFromInt(read(u32, buffer, offset))),
        types.Prop.INT32 => @as(f64, @floatFromInt(read(i32, buffer, offset))),
        types.Prop.NUMBER => read(f64, buffer, offset),
        else => undefined,
    };
}

pub inline fn datePart(timestamp: []u8, part: types.Interval) []const u8 {
    const ts = @as(i64, @intFromFloat(@trunc(read(f64, timestamp, 0))));
    const tz = 0; // temp
    return switch (part) {
        .hour => std.mem.asBytes(&selva.selva_gmtime_hour(ts, tz)),
        .day => std.mem.asBytes(&selva.selva_gmtime_mday(ts, tz)),
        .month => std.mem.asBytes(&selva.selva_gmtime_mon(ts, tz)),
        .year => std.mem.asBytes(&selva.selva_gmtime_year(ts, tz)),
        .dow => std.mem.asBytes(&selva.selva_gmtime_wday(ts, tz)),
        .doy => std.mem.asBytes(&selva.selva_gmtime_yday(ts, tz)),
        .isoDOW => std.mem.asBytes(&selva.selva_gmtime_wday2iso_wday(selva.selva_gmtime_wday(ts, tz))),
        // .week => std.mem.asBytes(&(selva.selva_gmtime_iso_wyear(ts, tz).iso_week)),
        // .quarter
        else => unreachable,
    };
}

pub fn addStep(key: []u8, step: u16) @TypeOf(key) {
    const result = key[0..];

    var carry: u16 = step;
    for (result) |*byte| {
        if (carry == 0) break;

        const sum: u16 = @as(u16, byte.*) + @as(u8, @truncate(carry));
        byte.* = @as(u8, @truncate(sum));
        carry = (carry >> 8) + (sum >> 8);
    }

    return result;
}

pub fn isInRange(x: []const u8, keyA: []const u8, keyB: []const u8) bool {
    const gte_keyA = switch (compareLE(x, keyA)) {
        .lt => false,
        .eq, .gt => true,
    };

    const lt_keyB = switch (compareLE(x, keyB)) {
        .lt => true,
        .eq, .gt => false,
    };
    return gte_keyA and lt_keyB;
}

pub fn compareLE(a: []const u8, b: []const u8) std.math.Ordering {
    if (a.len > b.len) return .gt;
    if (a.len < b.len) return .lt;

    var i: usize = a.len;
    while (i > 0) {
        i -= 1;
        const byte_a = a[i];
        const byte_b = b[i];

        if (byte_a > byte_b) return .gt;
        if (byte_a < byte_b) return .lt;
    }
    return .eq;
}

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
        .epoch => timestamp,
        else => timestamp, // do nothing = epoch
    };
}

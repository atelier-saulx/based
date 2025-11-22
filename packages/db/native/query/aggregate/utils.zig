const std = @import("std");
const types = @import("../../types.zig");
const utils = @import("../../utils.zig");
const read = utils.read;
const selva = @import("../../selva.zig").c;

pub inline fn microbufferToF64(propType: types.PropType, buffer: []u8, offset: usize) f64 {
    return switch (propType) {
        types.PropType.UINT8 => @as(f64, @floatFromInt(buffer[offset])),
        types.PropType.INT8 => @as(f64, @floatFromInt(buffer[offset])),
        types.PropType.UINT16 => @as(f64, @floatFromInt(read(u16, buffer, offset))),
        types.PropType.INT16 => @as(f64, @floatFromInt(read(i16, buffer, offset))),
        types.PropType.UINT32 => @as(f64, @floatFromInt(read(u32, buffer, offset))),
        types.PropType.INT32 => @as(f64, @floatFromInt(read(i32, buffer, offset))),
        types.PropType.NUMBER => read(f64, buffer, offset),
        else => undefined,
    };
}

pub inline fn datePart(timestamp: []u8, part: types.Interval, tz: i16) []const u8 {
    // tz in minutes to save 2 bytes (max tz is 14h = 840 min = 50400 sec)
    const ts = read(i64, timestamp, 0);
    return switch (part) {
        .hour => std.mem.asBytes(&selva.selva_gmtime_hour(ts, tz | 0)),
        .day => std.mem.asBytes(&selva.selva_gmtime_mday(ts, tz | 0)),
        .month => std.mem.asBytes(&selva.selva_gmtime_mon(ts, tz | 0)),
        .year => std.mem.asBytes(&selva.selva_gmtime_year(ts, tz | 0)),
        .dow => std.mem.asBytes(&selva.selva_gmtime_wday(ts, tz | 0)),
        .doy => std.mem.asBytes(&selva.selva_gmtime_yday(ts, tz | 0)),
        .isoDOW => std.mem.asBytes(&selva.selva_gmtime_wday2iso_wday(selva.selva_gmtime_wday(ts, tz | 0))),
        // .week => std.mem.asBytes(&(selva.selva_gmtime_iso_wyear(ts, tz).iso_week)),
        // .quarter
        .epoch => timestamp,
        else => timestamp, // do nothing = epoch
    };
}

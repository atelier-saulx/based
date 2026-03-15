const utils = @import("../../utils.zig");
const Thread = @import("../../thread/thread.zig");
const t = @import("../../types.zig");
const std = @import("std");
pub inline fn default(thread: *Thread.Thread, prop: u8, value: []u8) !void {
    if (value.len == 0) {
        return;
    }
    const header: t.IncludeResponse = .{ .prop = prop, .size = @truncate(value.len) };
    const headerSize = utils.sizeOf(t.IncludeResponse);
    const newSlice = try thread.query.slice(headerSize + value.len);
    utils.write(newSlice, header, 0);
    utils.write(newSlice, value, headerSize);
}

pub inline fn stripCrc32(thread: *Thread.Thread, prop: u8, value: []u8) !void {
    if (value.len == 0) {
        return;
    }
    const size = value.len - 4;
    const header: t.IncludeResponse = .{ .prop = prop, .size = @truncate(size) };
    const headerSize = utils.sizeOf(t.IncludeResponse);
    const newSlice = try thread.query.slice(headerSize + size);
    utils.write(newSlice, header, 0);
    utils.write(newSlice, value[0..size], headerSize);
}

pub inline fn meta(thread: *Thread.Thread, prop: u8, value: []u8) !void {
    if (value.len == 0) {
        return;
    }
    if (value[1] == 1) {
        _ = try thread.query.appendAs(t.IncludeResponseMeta, .{
            .op = t.ReadOp.meta,
            .prop = prop,
            .lang = @enumFromInt(value[0]),
            .compressed = true,
            ._padding = 0,
            .crc32 = utils.read(u32, value, value.len - 4),
            .size = utils.read(u32, value, 2),
        });
        _ = try thread.query.appendAs(u32, @truncate(value.len - 10));
    } else {
        _ = try thread.query.appendAs(t.IncludeResponseMeta, .{
            .op = t.ReadOp.meta,
            .prop = prop,
            .lang = @enumFromInt(value[0]),
            .compressed = false,
            ._padding = 0,
            .crc32 = utils.read(u32, value, value.len - 4),
            .size = @truncate(value.len - 6),
        });
    }
}

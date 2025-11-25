const utils = @import("../../utils.zig");
const Thread = @import("../../thread/thread.zig");
const t = @import("../../types.zig");

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

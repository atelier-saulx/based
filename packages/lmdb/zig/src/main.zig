const std = @import("std");
const root = @import("root.zig");
const lmdb = @import("lmdb");

const os = std.os;
const fs = std.fs;
const mem = std.mem;
const math = std.math;
const meta = std.meta;
const debug = std.debug;
const testing = std.testing;

//   map_size: usize = 10 * 1024 * 1024,
//     max_dbs: u32 = 0,
//     max_readers: u32 = 126,
//     read_only: bool = false,
//     write_map: bool = false,
//     no_tls: bool = false,
//     no_lock: bool = false,
//     mode: u16 = 0o664,

/// Fun with bla!
fn bla() !void {
    const env = try lmdb.Environment.init("./tmp", .{
        .map_size = 100 * 1024 * 1024 * 1024,
    });
    defer env.deinit();

    const txn = try lmdb.Transaction.init(env, .{ .mode = .ReadWrite });
    errdefer txn.abort();

    const currentTime = std.time.nanoTimestamp();

    var i: u32 = 0;
    // var key: [4]u8 = undefined;
    const value = "bla";

    while (i < 1_000_000) : (i += 1) {
        // std.mem.writeInt(u32, &key, i, .big);

        var buffer: [6]u8 = undefined; // Define a buffer to hold the string
        // adds 80ms
        const str = try std.fmt.bufPrint(&buffer, "{}", .{i});
        try txn.set(str, value);
    }

    std.debug.print("1M took ms: {}\n", .{@divFloor(std.time.nanoTimestamp() - currentTime, 1_000_000)});

    try txn.commit();
}

pub fn main() !void {
    try bla();
}

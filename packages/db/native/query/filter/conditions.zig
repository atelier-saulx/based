const std = @import("std");

pub fn runConditions(v: []u8, q: []u8) bool {
    var j: usize = 0;
    outside: while (j < q.len) {
        const operation = q[j];
        switch (operation) {
            // head equality
            1 => {
                const filter_size: u16 = std.mem.readInt(
                    u16,
                    q[j + 1 ..][0..2],
                    .little,
                );
                const index: u16 = std.mem.readInt(
                    u16,
                    q[j + 3 ..][0..2],
                    .little,
                );
                const hit = std.mem.eql(u8, q[j + 5 .. j + 5 + filter_size], v[index .. index + filter_size]);
                if (!hit) {
                    return false;
                }
                j += filter_size + 5;
                continue :outside;
            },
            // seperate field equality
            2 => {
                const filter_size: u16 = std.mem.readInt(
                    u16,
                    q[j + 1 ..][0..2],
                    .little,
                );
                if (v.len != filter_size) {
                    return false;
                }
                const hit = std.mem.eql(u8, q[j + 3 .. j + 3 + filter_size], v[0..filter_size]);
                if (!hit) {
                    return false;
                }
                j += filter_size + 3;
                continue :outside;
            },
            3 => {
                // >, greater than
                const filter_size: u16 = std.mem.readInt(
                    u16,
                    q[j + 1 ..][0..2],
                    .little,
                );
                const index: u16 = std.mem.readInt(
                    u16,
                    q[j + 3 ..][0..2],
                    .little,
                );

                switch (filter_size) {
                    4 => {
                        const query = std.mem.readInt(i32, q[j + 5 ..][0..4], .little);
                        const value = std.mem.readInt(i32, v[index..][0..4], .little);
                        if (value > query) {
                            j += filter_size + 5;
                            continue :outside;
                        }
                        return false;
                    },
                    8 => {
                        const query = std.mem.readInt(i64, q[j + 5 ..][0..8], .little);
                        const value = std.mem.readInt(i64, v[index..][0..8], .little);
                        if (value > query) {
                            j += filter_size + 5;
                            continue :outside;
                        }
                        return false;
                    },
                    else => {
                        std.log.err(
                            "Unexpected filter size \"{}\" for operation \"{}\", ignoring filter.\n",
                            .{ filter_size, operation },
                        );
                        return false;
                    },
                }
            },
            4 => {
                // <, less than
                const filter_size: u16 = std.mem.readInt(
                    u16,
                    q[j + 1 ..][0..2],
                    .little,
                );
                const index: u16 = std.mem.readInt(
                    u16,
                    q[j + 3 ..][0..2],
                    .little,
                );

                switch (filter_size) {
                    4 => {
                        const query = std.mem.readInt(i32, q[j + 5 ..][0..4], .little);
                        const value = std.mem.readInt(i32, v[index..][0..4], .little);
                        if (value < query) {
                            j += filter_size + 5;
                            continue :outside;
                        }
                        return false;
                    },
                    8 => {
                        const query = std.mem.readInt(i64, q[j + 5 ..][0..8], .little);
                        const value = std.mem.readInt(i64, v[index..][0..8], .little);
                        if (value < query) {
                            j += filter_size + 5;
                            continue :outside;
                        }
                        return false;
                    },
                    else => {
                        std.log.err(
                            "Unexpected filter size \"{}\" for operation \"{}\", ignoring filter.\n",
                            .{ filter_size, operation },
                        );
                        return false;
                    },
                }
            },

            // seperate field has check
            7 => {
                const filter_size: u16 = std.mem.readInt(
                    u16,
                    q[j + 1 ..][0..2],
                    .little,
                );
                var i: u16 = 0;
                while (i < v.len) : (i += 4) {
                    var p: usize = j + 3;
                    while (p < filter_size * 4 + j + 3) : (p += 4) {
                        if (v[i] != q[p] or v[i + 1] != q[p + 1] or v[i + 2] != q[p + 2] or v[i + 3] != q[p + 3]) {
                            continue;
                        }
                        j += filter_size * 4 + 3;
                        continue :outside;
                    }
                }
                return false;
            },
            else => {
                std.log.err("\nIncorrectly encoded condition (operation not handled)", .{});
                return false;
            },
        }
    }
    return true;
}

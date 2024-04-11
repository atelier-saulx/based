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
                for (
                    q[j + 5 .. j + 5 + filter_size],
                    0..,
                ) |byte, z| {
                    if (byte != v[index + z]) {
                        return false;
                    }
                    if (index + z == v.len - 1) {
                        j += filter_size + 5;
                        continue :outside;
                    }
                }
                return false;
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
                for (
                    q[j + 3 .. j + 3 + filter_size],
                    0..,
                ) |byte, z| {
                    if (byte != v[z]) {
                        return false;
                    }
                    if (z == v.len - 1) {
                        j += filter_size + 3;
                        continue :outside;
                    }
                }
                return false;
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
                        // TODO simD operations would be great here...
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
                std.debug.print("\nIncorrectly encoded condition (operation not handled)", .{});
                return false;
            },
        }
    }
    return true;
}

const std = @import("std");

pub fn runQuery(value: []u8, query: [*]u8, size: usize) bool {
    var j: usize = 0;
    outside: while (j < size) {
        const operation = query[j];

        if (operation == 1) {
            const filter_size: u16 = std.mem.readInt(
                u16,
                query[j + 1 ..][0..2],
                .little,
            );
            const index: u16 = std.mem.readInt(
                u16,
                query[j + 3 ..][0..2],
                .little,
            );
            for (
                query[j + 5 .. j + 5 + filter_size],
                0..,
            ) |byte, z| {
                if (byte != value[index + z]) {
                    return false;
                }
                if (index + z == value.len - 1) {
                    j += filter_size + 3;
                    continue :outside;
                }
            }
            return false;
        } else if (operation == 2) {
            const filter_size: u16 = std.mem.readInt(
                u16,
                query[j + 1 ..][0..2],
                .little,
            );
            if (value.len != filter_size) {
                return false;
            }
            for (
                query[j + 3 .. j + 3 + filter_size],
                0..,
            ) |byte, z| {
                if (byte != value[z]) {
                    return false;
                }
                if (z == value.len - 1) {
                    j += filter_size + 3;
                    continue :outside;
                }
            }
            return false;
        } else if (operation == 7) {
            const filter_size: u16 = std.mem.readInt(
                u16,
                query[j + 1 ..][0..2],
                .little,
            );

            var i: u16 = 0;

            while (i < value.len) : (i += 4) {
                var p: usize = j + 3;
                while (p < filter_size * 4 + j + 3) : (p += 4) {
                    if (value[i] != query[p]) {
                        continue;
                    }
                    if (value[i + 1] != query[p + 1]) {
                        continue;
                    }
                    if (value[i + 2] != query[p + 2]) {
                        continue;
                    }
                    if (value[i + 3] != query[p + 3]) {
                        continue;
                    }

                    j += filter_size * 4 + 3;
                    continue :outside;
                }
            }
            return false;
        } else {
            std.debug.print("WRONG\n", .{});

            return true;
        }
    }

    return true;
}

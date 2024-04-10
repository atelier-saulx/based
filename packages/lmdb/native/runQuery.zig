const std = @import("std");

pub fn runQuery(value: []u8, query: [*]u8, size: usize) bool {
    var j: usize = 0;
    while (j < size) {
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
                    return true;
                }
            }
            j += filter_size + 3;
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
                    return true;
                }
            }
            j += filter_size + 3;
        }
    }
    return false;
}

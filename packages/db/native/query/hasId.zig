const std = @import("std");

pub inline fn hasId(id: u32, ids: []u32, last: *usize) bool {
    var i: usize = 0;
    const l = last.*;
    while (i <= l) : (i += 1) {
        const id2 = ids[i];
        if (id2 == id) {
            ids[i] = ids[l];
            last.* -= 1;
            return true;
        }
    }
    return false;
}

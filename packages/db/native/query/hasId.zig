const std = @import("std");

pub fn hasId(id: u32, ids: []u8) bool {
    var hasIdBool = false;
    var i: usize = 0;
    // TODO: absolute sloweest way of looping trough ids...
    while (i <= ids.len) : (i += 4) {
        const id2 = std.mem.readInt(u32, ids[i..][0..4], .little);
        if (id2 == id) {
            hasIdBool = true;
            break;
        }
    }
    return hasIdBool;
}

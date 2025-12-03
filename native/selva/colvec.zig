const std = @import("std");
const selva = @import("selva/selva.zig").c;
const Node = @import("selva/Node.zig");
const Schema = @import("selva/schema.zig");

pub fn ColvecIterator(comptime T: type) type {
    return struct {
        blockCapacity: usize,
        cv: selva.c.SelvaColvec,
        vecLen: usize, // number of elements
        vecSize: usize, // size in bytes
        nodeId: selva.c.node_id_t,
        pub inline fn next(self: *ColvecIterator(T)) ?[]T {
            const i = selva.c.selva_node_id2block_i3(self.blockCapacity, self.nodeId);
            const off: usize = ((self.nodeId - 1) % self.blockCapacity) * self.vecSize;
            const slab: [*c]u8 = @ptrCast(self.cv.*.v[i]);

            if (slab == null) {
                return null;
            }

            self.nodeId += 1;

            const fvec: [*c]T = @alignCast(@ptrCast(slab + off));
            return fvec[0..self.vecLen];
        }
    };
}

pub fn iterator(
    comptime T: type,
    te: selva.Type,
    fs: Schema.FieldSchema,
    nodeId: selva.node_id_t
) ColvecIterator(T) {
    const blockCapacity = selva.selva_get_block_capacity(te);
    const cv = selva.c.colvec_get(te, fs);

    std.debug.assert(fs.*.type == selva.c.SELVA_FIELD_TYPE_COLVEC);
    std.debug.assert(cv.*.vec_size == @bitSizeOf(T) / 8 * fs.*.colvec.vec_len);

    return ColvecIterator(T){
        .blockCapacity = blockCapacity,
        .cv = cv,
        .vecLen = fs.*.colvec.vec_len,
        .vecSize = cv.*.vec_size,
        .nodeId = nodeId,
    };
}

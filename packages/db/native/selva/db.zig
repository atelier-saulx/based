const std = @import("std");
const t = @import("../types.zig");
const SelvaHash128 = @import("../string.zig").SelvaHash128;
const selva = @import("selva.zig").c;
const st = @import("selva.zig");
const Schema = @import("schema.zig");
const errors = @import("../errors.zig");
const utils = @import("../utils.zig");
const valgrind = @import("../valgrind.zig");
const config = @import("config");
const Node = @import("node.zig");
const References = @import("references.zig");
const Modify = @import("../modify/common.zig");
pub const DbCtx = @import("../db/ctx.zig").DbCtx;

const Type = Node.Type;
pub const Aliases = st.Aliases;

// TODO Don't publish from here
pub const ReferenceSmall = st.ReferenceSmall;
pub const ReferenceLarge = st.ReferenceLarge;
pub const ReferenceAny = st.ReferenceAny;

extern "c" const selva_string: opaque {};

pub fn getNodeBlockHash(db: *DbCtx, typeEntry: Type, start: u32, hashOut: *SelvaHash128) c_int {
    return selva.selva_node_block_hash(db.selva, typeEntry, start, hashOut);
}

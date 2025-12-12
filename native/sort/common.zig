const t = @import("../types.zig");
const selva = @import("../selva/selva.zig").c;

pub const SortIndexMeta = struct {
    prop: t.PropType,
    start: u16,
    len: u16, // len can be added somewhere else
    index: *selva.SelvaSortCtx,
    langCode: t.LangCode,
    field: u8,
    isCreated: bool,
};

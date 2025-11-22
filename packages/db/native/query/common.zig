const std = @import("std");
const results = @import("./results.zig");
const db = @import("../db/db.zig");
const types = @import("../types.zig");
const utils = @import("../utils.zig");

pub const QueryCtx = struct {
    results: std.array_list.Managed(results.Result),
    size: usize,
    totalResults: usize,
    aggResult: ?u32, // adds 8 bytes for no reason
    allocator: std.mem.Allocator,
    db: *db.DbCtx,
    threadCtx: *db.DbThread,
    id: u32,
};

pub const FilterType = enum(u8) {
    none = 0,
    simple = 1,
    default = 2,
};

pub const QueryDefaultHeader = packed struct {
    typeId: db.TypeId,
    offset: u32,
    limit: u32,
    sortSize: u16,
    filterSize: u16,
    searchSize: u16,
    simpleFilter: u8,
};

pub const QueryIdHeader = packed struct {
    typeId: db.TypeId,
    filterSize: u16,
};

pub const QueryAliasHeader = packed struct {
    typeId: db.TypeId,
    filterSize: u16,
    valueSize: u16,
};

pub const QuerySortHeader = packed struct {
    order: u8,
    prop: u8, // use prop type for this
    propType: types.PropType,
    start: u16,
    len: u16,
    lang: types.LangCode,
};

// for filter etc
// pub const QuerySort = struct {
//     header: QuerySortHeader,
//     buf: []u8,
// };

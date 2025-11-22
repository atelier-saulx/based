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
pub const QuerySubType = enum(u8) {
    // --- NO SEARCH ---
    default = 0, //                   Filter: [ X ],  Sort: [ X     ],  Search: [ X   ]
    filter = 1, //                    Filter: [ √ ],  Sort: [ X     ],  Search: [ X   ]
    sortAsc = 2, //                   Filter: [ X ],  Sort: [ASC    ],  Search: [ X   ]
    sortAscFilter = 3, //             Filter: [ √ ],  Sort: [ASC    ],  Search: [ X   ]
    sortDesc = 4, //                  Filter: [ X ],  Sort: [DESC   ],  Search: [ X   ]
    sortDescFilter = 5, //            Filter: [ √ ],  Sort: [DESC   ],  Search: [ X   ]
    sortIdDesc = 6, //                Filter: [ X ],  Sort: [ID_DESC],  Search: [ X   ]
    sortIdDescFilter = 7, //          Filter: [ √ ],  Sort: [ID_DESC],  Search: [ X   ]

    // --- TEXT SEARCH ---
    search = 8, //                    Filter: [ X ],  Sort: [ X     ],  Search: [TEXT ]
    searchFilter = 9, //              Filter: [ √ ],  Sort: [ X     ],  Search: [TEXT ]
    searchSortAsc = 10, //            Filter: [ X ],  Sort: [ASC    ],  Search: [TEXT ]
    searchSortAscFilter = 11, //      Filter: [ √ ],  Sort: [ASC    ],  Search: [TEXT ]
    searchSortDesc = 12, //           Filter: [ X ],  Sort: [DESC   ],  Search: [TEXT ]
    searchSortDescFilter = 13, //     Filter: [ √ ],  Sort: [DESC   ],  Search: [TEXT ]
    searchSortIdDesc = 14, //         Filter: [ X ],  Sort: [ID_DESC],  Search: [TEXT ]
    searchSortIdDescFilter = 15, //   Filter: [ √ ],  Sort: [ID_DESC],  Search: [TEXT ]

    // --- VECTOR SEARCH ---
    vec = 16, //                      Filter: [ X ],  Sort: [ X     ],  Search: [ VEC ]
    vecFilter = 17, //                Filter: [ √ ],  Sort: [ X     ],  Search: [ VEC ]
    vecSortAsc = 18, //               Filter: [ X ],  Sort: [ASC    ],  Search: [ VEC ]
    vecSortAscFilter = 19, //         Filter: [ √ ],  Sort: [ASC    ],  Search: [ VEC ]
    vecSortDesc = 20, //              Filter: [ X ],  Sort: [DESC   ],  Search: [ VEC ]
    vecSortDescFilter = 21, //        Filter: [ √ ],  Sort: [DESC   ],  Search: [ VEC ]
    vecSortIdDesc = 22, //            Filter: [ X ],  Sort: [ID_DESC],  Search: [ VEC ]
    vecSortIdDescFilter = 23, //      Filter: [ √ ],  Sort: [ID_DESC],  Search: [ VEC ]
};

pub const QueryDefaultHeader = packed struct {
    typeId: db.TypeId,
    offset: u32,
    limit: u32,
    sortSize: u16,
    filterSize: u16,
    searchSize: u16,
    subType: QuerySubType,
};

pub const QueryIdHeader = packed struct {
    typeId: db.TypeId,
    filterSize: u16,
};

// pub const QueryIdsHeader = packed struct {
//     typeId: db.TypeId,
//     filterSize: u16,
// };

pub const QueryAliasHeader = packed struct {
    typeId: db.TypeId,
    filterSize: u16,
    valueSize: u16,
};

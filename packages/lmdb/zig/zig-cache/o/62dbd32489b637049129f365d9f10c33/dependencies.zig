pub const packages = struct {
    pub const @"12208c41a60cc152bb8b16d355f75b5302d3f1030188fdf941966dfbf2cf3930721f" = struct {
        pub const build_root = "/Users/jimdebeer/.cache/zig/p/12208c41a60cc152bb8b16d355f75b5302d3f1030188fdf941966dfbf2cf3930721f";
        pub const build_zig = @import("12208c41a60cc152bb8b16d355f75b5302d3f1030188fdf941966dfbf2cf3930721f");
        pub const deps: []const struct { []const u8, []const u8 } = &.{
            .{ "lmdb", "12209bfdbf43d479c2cac0ca2212853ab2136f1621f49461f62c7932a7819bc29110" },
        };
    };
    pub const @"12209bfdbf43d479c2cac0ca2212853ab2136f1621f49461f62c7932a7819bc29110" = struct {
        pub const build_root = "/Users/jimdebeer/.cache/zig/p/12209bfdbf43d479c2cac0ca2212853ab2136f1621f49461f62c7932a7819bc29110";
        pub const deps: []const struct { []const u8, []const u8 } = &.{};
    };
};

pub const root_deps: []const struct { []const u8, []const u8 } = &.{
    .{ "ziglmdb", "12208c41a60cc152bb8b16d355f75b5302d3f1030188fdf941966dfbf2cf3930721f" },
};

pub const packages = struct {
    pub const @"12209858bcdacf486d04fdebe1c46c3efab5cef52cc50d6f534d714b688ca52ca068" = struct {
        pub const build_root = "/Users/jimdebeer/.cache/zig/p/12209858bcdacf486d04fdebe1c46c3efab5cef52cc50d6f534d714b688ca52ca068";
        pub const build_zig = @import("12209858bcdacf486d04fdebe1c46c3efab5cef52cc50d6f534d714b688ca52ca068");
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
    .{ "lmdb", "12209858bcdacf486d04fdebe1c46c3efab5cef52cc50d6f534d714b688ca52ca068" },
};

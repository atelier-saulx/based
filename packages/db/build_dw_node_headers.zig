const std = @import("std");

// Function to download and extract Node.js headers for a given version
pub fn download_node_headers(version: []const u8) !void {
    const allocator = std.heap.page_allocator;
    var stdout = std.io.getStdOut().writer();
    var cwd = std.fs.cwd();

    // Construct the headers URL based on the version
    const headers_url = try construct_headers_url(allocator, version);
    defer allocator.free(headers_url);

    // Remove and create 'deps' directory
    try cwd.deleteDir("deps");
    try cwd.makeDir("deps");

    // Determine tarball filename
    const tarball_name = std.fs.path.basename(headers_url);
    const headers_tarball = try std.fmt.allocPrint(allocator, "deps/{s}", .{tarball_name});

    // Download tarball using wget or curl
    // Executa o comando `wget` diretamente
    var child = std.process.Child.init(&[_][]const u8{
        "wget",
        "--quiet",
        "--show-progress",
        "--output-document=" ++ headers_tarball,
        headers_url,
    }, allocator);

    // Configura o comportamento de stdin, stdout e stderr
    child.stdin_behavior = .Ignore; // Ignora a entrada padrão
    child.stdout_behavior = .Ignore; // Ignora a saída padrão
    child.stderr_behavior = .Ignore; // Ignora a saída de erro

    // Inicia o processo
    try child.spawn();

    // Espera o processo terminar
    _ = try child.wait();

    // Extract tarball using tar
    try stdout.print("Extracting {s}...\n", .{headers_tarball});
    try std.process.shell(try std.fmt.allocPrint(allocator, "tar -xf {s} -C deps", .{headers_tarball})).wait();

    // Remove tarball
    try cwd.removePath(headers_tarball);
}

// Helper function to construct the headers URL based on the Node.js version
fn construct_headers_url(allocator: std.mem.Allocator, version: []const u8) ![]const u8 {
    // Example URL pattern: https://nodejs.org/dist/v22.13.0/node-v22.13.0-headers.tar.gz
    return try std.fmt.allocPrint(allocator, "https://nodejs.org/dist/{s}/node-{s}-headers.tar.gz", .{ version, version });
}

pub fn main() !void {
    // Replace "v22.13.0" with the desired Node.js version
    try download_node_headers("v20.11.1");
}

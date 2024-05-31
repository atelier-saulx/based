const zlib = require("zlib");

var input = "All things are changing: and thou thyself art in continuous mutation and in a manner in continuous destruction, and the whole universe too.";

zlib.deflateRaw(input, (err, buffer) => {
    process.stdout.write(buffer);
});

# Database Exporter Utility
Availabe in: v0.0.72

## Overview

The Database Exporter Utility converts saved databases from the native `.sdb` format (created with `db.save()`) to other formats. Currently, the utility supports export to CSV format, with additional formats planned for future releases.

The utility maintains the original file structure and distribution of the dumped files while operating in memory-efficient chunks to minimize resource usage.

## File Naming Convention

Input files follow the standard BasedDB dump naming pattern: `{typeId}_{nodeStartId}_{maxNodeId}.sdb`

- **typeId**: Identifier for the data type
- **nodeStartId**: Starting node ID for the data in the file
- **maxNodeId**: Maximum node ID per file (indicates the chunk size)

Output files will maintain the original file name with the appropriate file extension (e.g., `.csv`).

## Usage

### Basic Command

```bash
npm start
```

This command will:

- Process all `.sdb` files in the default directory
- Export them to CSV format in the default output directory
- Operate silently with no progress output

### Verbose Mode

```bash
npm start -- verbose
```

This command enables verbose output, displaying progress information during the export process.

### Custom Output Directory

```bash
npm start -- dest=~/my_dumps_in_csvs
```

This command:

- Processes all `.sdb` files in the default directory
- Exports them to the specified custom directory (`~/my_dumps_in_csvs`)
- Creates the directory if it doesn't exist
- Overwrites any existing files with the same names
- *Currently references are not exported. Referred properties are exported as well as properties*.

### Combined Options

```bash
npm start -- verbose dest=~/my_dumps_in_csvs
```

This command combines both verbose output and custom directory options.

## Behavior Notes

- The utility processes files in chunks to maintain low memory usage
- Existing files in the output directory with matching names will be overwritten without warning
- Output directories are created recursively if they don't exist
- The utility maintains the original file distribution pattern in the output files

## Future Enhancements

Planned future export formats include:

- SQL formats
- Parquet

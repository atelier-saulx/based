# Database Exporter Utility

A utility for converting database backups from the native `.sdb` format (created with `db.save()`) to other formats. Currently supports export to CSV format, with additional formats planned for future releases.

The utility maintains the original file structure and distribution of the backup files while operating in memory-efficient chunks to minimize resource usage.

## Features

- Converts `.sdb` database backups to CSV format
- Memory-efficient processing using configurable chunk sizes
- Preserves original file structure and distribution
- Configurable locale handling for TEXT properties
- Verbose logging option for detailed operation information
- Customizable output directory

## Installation

1. Ensure you have Node.js installed
2. Clone or download this utility
3. Install dependencies:
   ```bash
   npm i
   ```
4. Build

```bash
npm run build
```

## Usage

```bash
npm start -- [options]
```

### Options

- `verbose`: Enable verbose logging
- `dest=<path>`: Set output directory (default: `./tmp/export`)
- `chunk=<size>`: Set chunk size for processing (default: 1025)
- `locale=<locale_code>`: Set locale for TEXT properties (e.g., `en`, `fr`)

### Examples

Basic usage:

```bash
npm start
```

With verbose logging and custom output directory:

```bash
npm start verbose dest=./my-exports
```

With custom chunk size and locale:

```bash
npm start chunk=10000 locale=en
```

With all options:

```bash
npm start verbose dest=./output chunk=10000 locale=fr
```

## Output

The utility creates CSV files in the specified output directory following the backup sintax wich has the following naming format:

```
{typeId}_{startNodeId}_{endNodeId}.csv
```

Where:

- `typeId`: The numeric identifier for the data type
- `startNodeId`: The starting node ID of the block
- `endNodeId`: The ending node ID of the block

Each CSV file includes:

- An `id` column for the node identifier
- Columns for each property in the schema (excluding references)

## Configuration Details

### Chunk Size

The `chunk` parameter controls how many records are processed at once. Larger chunk sizes may improve performance but use more memory. The default value is 1025.

### Locale Handling

The `locale` parameter specifies which language variant to use for TEXT properties when multiple locales are available in the database schema. If not specified, the utility will use the first available locale in the schema. A wrong locale will skip the values in the property's column.

### Output Directory

The `dest` parameter allows you to specify where the exported files should be saved. The directory will be created if it doesn't exist. The default output directory is `./tmp/export`.

### Verbose Mode

When enabled with the `verbose` flag, the utility provides detailed information about its operation, including:

- Which blocks are being processed
- File opening and writing operations
- Chunk processing progress
- Completion status for each block

## Requirements

- Node.js
- BasedDB database backups in `.sdb` format
- The backup files should be located in the `./tmp` directory (can be modified in code)

## Notes

- The utility does not export REFERENCE and REFERENCES type properties
- The utility processes each block independently, maintaining the original distribution of data
- Output files are named according to the block they represent
- The utility automatically creates the output directory if it doesn't exist

## Future Enhancements

Planned features for future releases:

- Support for additional export formats (Parquet, SQL)
- Support for exporting reference relationships

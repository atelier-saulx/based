# @based/schema

## Types

- [Timestamp](db/types?id=timestamp)
- [Boolean](db/types?id=boolean)
- [Numeric](db/types?id=numeric)
- [Alias](db/types?id=alias)
- [Enum](db/types?id=enum)
- [JSON](db/types?id=json)
- [Binary](db/types?id=binary)
- [String and Text](db/types?id=string-and-text)
- [Cardinality](db/types?id=cardinality)
- [vector](db/types?id=vector)
- [colvec](db/types?id=colvec)

## Display & format

Using `display` will not validate or transform and will purely change how the value is shown in UI and API.

Use `format` to specify in which format the value has to represented and modified. This may impose some validation and will influence how the UI shows the value.

**For example**:

```js
{
    types: {
        article: {
            props: {
                price: {
                    type: 'int32',
                    display: 'euro',
                },
                authorEmail: {
                    type: 'string',
                    format: 'email',
                    display: 'lowercase',
                },
                lastModified: {
                    type: 'timestamp',
                    display: 'date-time'
                }
            }
        }
    }
}
```

### Display options

#### Timestamp

```
'date',
'date-time',
'date-time-text',
'human',
'time',
'time-precise',
```

#### Number

```
'short',
'human',
'ratio',
'bytes',
'euro',
'dollar',
'pound',

'round-short',
'round-human',
'round-ratio',
'round-bytes',
'round-euro',
'round-dollar',
'round-pound',
```

#### String

```
'lowercase',
'uppercase',
'capitalize',
```

### Format options

#### String

```
'email',
'URL',
'MACAddress',
'IP',
'IPRange',
'FQDN',
'IBAN',
'BIC',
'alpha',
'alphaLocales',
'alphanumeric',
'alphanumericLocales',
'passportNumber',
'port',
'lowercase',
'uppercase',
'ascii',
'semVer',
'surrogatePair',
'IMEI',
'hexadecimal',
'octal',
'hexColor',
'rgbColor',
'HSL',
'ISRC',
'MD5',
'JWT',
'UUID',
'luhnNumber',
'creditCard',
'identityCard',
'EAN',
'ISIN',
'ISBN',
'ISSN',
'mobilePhone',
'mobilePhoneLocales',
'postalCode',
'postalCodeLocales',
'ethereumAddress',
'currency',
'btcAddress',
'ISO6391',
'ISO8601',
'RFC3339',
'ISO31661Alpha2',
'ISO31661Alpha3',
'ISO4217',
'base32',
'base58',
'base64',
'dataURI',
'magnetURI',
'mimeType',
'latLong',
'slug',
'strongPassword',
'taxID',
'licensePlate',
'VAT',
'code',
'typescript',
'javascript',
'python',
'rust',
'css',
'html',
'json',
'markdown',
'clike'
```

## Mermaid diagrams

The package [schema-diagram](https://github.com/atelier-saulx/based/tree/docs/packages/schema-diagram) allow drawing a diagram from schema.
See example [here](/schema-diagram).

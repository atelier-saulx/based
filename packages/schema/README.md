# @based/schema

## Display & format WIP

Use `format` to specify in which format the value has to represented and modified. This may impose some validation and will influence how the UI shows the value.

### For example

```ts
{
    types: {
        article: {
            props: {
                price: {
                    type: 'int32',
                },
                authorEmail: {
                    type: 'string',
                    format: 'email',
                },
                lastModified: {
                    type: 'timestamp',
                }
            }
        }
    }
}
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
'password',
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

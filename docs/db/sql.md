Migrating from SQL
==================

Northwind
---------

The [Northwind](https://github.com/atelier-saulx/based/blob/main/packages/db/test/shared/northwindDb.ts)
database is a sample database that was originally created by Microsoft and used in
many of their database tutorials. The Northwind database contains the sales data
for a fictitious company called “Northwind Traders”, which imports and exports
specialty foods from around the world. We have adapted a version of the
Northwind database to Based DB to demonstrate how easy it's to migrate from a
SQL database to Based DB.

```mermaid
classDiagram
categories : categoryName __string__
categories : description __text__
categories : picture __binary__
categories --> products : products[]
customerDemographics : customerDesc __text__
customerDemographics --> customers : customers[]
customers : customerId __alias__
customers : companyName __string__
customers : contactName __string__
customers : contactTitle __string__
customers : address __string__
customers : city __string__
customers : region __string__
customers : postalCode __string__
customers : country __string__
customers : phone __string__
customers : fax __string__
customers --> customerDemographics : customerDemo[]
customers --> orders : orders[]
employees : lastName __string__
employees : firstName __string__
employees : title __string__
employees : titleOfCourtesy __string__
employees : birthDate __timestamp__
employees : hireDate __timestamp__
employees : address __string__
employees : city __string__
employees : region __string__
employees : postalCode __string__
employees : country __string__
employees : homePhone __string__
employees : extension __string__
employees : photo __binary__
employees : notes __text__
employees --> employees : reportsTo
employees : photoPath __string__
employees --> territories : territories[]
employees --> employees : subordinates[]
employees --> orders : orders[]
suppliers : companyName __string__
suppliers : contactName __string__
suppliers : contactTitle __string__
suppliers : address __string__
suppliers : city __string__
suppliers : region __string__
suppliers : postalCode __string__
suppliers : country __string__
suppliers : phone __string__
suppliers : fax __string__
suppliers : homepage __string__
suppliers --> products : products[]
products : productName __string__
products --> suppliers : supplier
products --> categories : category
products : quantityPerUnit __string__
products : unitPrice __number__
products : unitsInStock __int16__
products : unitsOnOrder __int16__
products : reorderLevel __int16__
products : discontinued __int32__
products --> orderDetails : orders[]
region : regionDescription __string__
region --> territories : territories[]
shippers : companyName __string__
shippers : phone __string__
shippers --> orders : orders[]
orders --> customers : customer
orders --> employees : employee
orders : orderStatus __enum__
orders : orderDate __timestamp__
orders : requiredDate __timestamp__
orders : shippedDate __timestamp__
orders --> shippers : shipVia
orders : freight __number__
orders : shipName __string__
orders : shipAddress __string__
orders : shipCity __string__
orders : shipRegion __string__
orders : shipPostalCode __string__
orders : shipCountry __string__
orders --> orderDetails : details[]
territories : territoryId __alias__
territories : territoryDescription __string__
territories --> region : region
territories --> employees : employees[]
orderDetails --> orders : order
orderDetails --> products : product
orderDetails : unitPrice __number__
orderDetails : quantity __int16__
orderDetails : discount __number__
usStates : stateName __string__
usStates : stateAbbr __string__
usStates : stateRegion __string__
```

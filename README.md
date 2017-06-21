# Size Facet Categories Service
This Application is a built on top of the service provided under https://github.com/islammenshawy/size-facet_categories 

The mapper will utilize the product feed to generate another file that will contain the size facets mapping with SKU to ease 
the mapping of the SFCs to SKU records

## Getting Started
These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. Also the service is deployed cloud foundry to help test products.

### Prerequisites for running in local
```
install node v6.10.3
run using command: node index.js ${FileName}
```
### Output files and format
The application will generate 2 files one with the SKUs that got mapped that are inventory available with [_SFCs] in the name and 
another file with the SKUs that didn't get mapped with name ending with [_SFCs_Non]

The non mapped SKUs are not associated with any SFCs and for testing purpose on search page

Header information:
SKU|WebModel|Dimension|Variance|size1|size2|Dimension|

### Examples run with sample file
```
node index.js on_us_ol_fullText

```


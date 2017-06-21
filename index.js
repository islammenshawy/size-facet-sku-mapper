"use strict";
var mappings = require('./size_mappings')
var Excel = require('exceljs');
var fs = require('fs');
require('console-stamp')(console, '[HH:MM:ss.l]');


var szmodelWorkbook = new Excel.Workbook();
var sfcWorkbook = new Excel.Workbook();
var tagsSfcCache = undefined;
var sfcsSizeModelCache = undefined;

//set the size facet categories cache
var setSfcCache = function(cache){
  tagsSfcCache = cache;
  console.warn('Finished loading size facet categories cache .......');
  //console.warn(tagsSfcCache);
};

//set the size facet size model cache
var setSfcSzModelCache = function(cache){
  sfcsSizeModelCache = cache;
  console.warn('Finished loading size model cache .......');
  createMappingFile();
};

//Load both excel sheets into cache
mappings.loadSfcsCache(sfcWorkbook, szmodelWorkbook, setSfcCache, setSfcSzModelCache);

function createMappingFile(){
      console.time("mapping file");

      var productFeedFileName = __dirname + "/" + process.argv[2];
      var styleRecords = {};
      var productMappingOutputFileName = productFeedFileName + '_SFCs';
      var productMappingErrorOutputFile = productFeedFileName + '_SFCs_Non';

      // ***** Purge previous files and create stream writers for them
      if (fs.existsSync(productMappingOutputFileName)) {
        fs.unlink(productMappingOutputFileName);
      }
      if (fs.existsSync(productMappingErrorOutputFile)) {
        fs.unlink(productMappingErrorOutputFile);
      }
      var outputFile = fs.createWriteStream(productMappingOutputFileName, {flags: 'a'});
      var errorOutputFile = fs.createWriteStream(productMappingErrorOutputFile, {flags: 'a'});
      // *****

      var lineReader = require('readline').createInterface({
        input: require('fs').createReadStream(productFeedFileName)
      });

      lineReader.on('line', function (line) {
          if(line.startsWith('ST') && styleRecords['records'] !== undefined && styleRecords['records'].length > 0){
            try{
              createStyleSKUsMappingRecords(styleRecords['records'], outputFile, errorOutputFile, tagsSfcCache, sfcsSizeModelCache);
            }catch(err){
              console.error('Exception happened during processing' + err);
            }
            styleRecords['records'] = [];
            styleRecords['records'].push(line);
          }
          else{
            if(styleRecords['records'] === undefined){
              var record = [];
              record.push(line);
              styleRecords['records'] = record;
            }
            else{
              styleRecords['records'].push(line);
            }
          }
      });
      console.warn('End of file processing');
      console.timeEnd("mapping file");
};

var styleTagsIndex = 19;
var sizeModelIndex = 30;
var skuInventoryStatusIndex=3;

function createStyleSKUsMappingRecords(styleRecords, outputFile, errorOutputFile, tagsSfcCache, sfcsSizeModelCache){
  // console.log('There are that number of SKUs sent to the method: ' + styleRecords.length)
  var productTags = {};
  var sizeModel = '';
  var skuRecords = [];
  var atLeastOneSKUInstock = false;
  for(var record of styleRecords){
    var attributes = record.split('|');
    if(attributes[0] == 'ST'){
      //console.log('Parsing product attributes for style [' + attributes[1] + ']');
      productTags = JSON.parse(attributes[styleTagsIndex]);
    }
    else if(attributes[0] == 'SC'){
      sizeModel = attributes[sizeModelIndex];
    }
    else if(attributes[0] == 'SK' && attributes[3] == '0'){
      //console.log('Inventory status: ' + attributes[3]);
      var skuBusIdSzCodePair = {};
      var skuBusId = attributes[1];
      var sizecode = attributes[1].substring(9,13);
      skuBusIdSzCodePair[sizecode] = skuBusId;
      skuRecords.push(skuBusIdSzCodePair);
      atLeastOneSKUInstock = true;
    }
  }
  // console.warn('before the get method :' + sizeModel, productTags, skuRecords);
  var SFCs = undefined;
  if(atLeastOneSKUInstock){
      SFCs = mappings.getProductSfcs(productTags, sizeModel, skuRecords, tagsSfcCache, sfcsSizeModelCache);

    if(SFCs !== undefined){
      SFCs.forEach(function(v) { outputFile.write(v + '\n'); });
    }
    else{
      styleRecords.forEach(function(record) {
        if(record.startsWith('ST')){
          var attributes = record.split('|');
          //Validate product tags till you finalize the bug for product tags.
          //var productStyle = attributes[1];
          // var productTags = mappings.getProductTags(productStyle);
          // if(productTags !== undefined && productTags['ProductTags'] !== undefined){
          //   var DepartmentTags = productTags['ProductTags']['DepartmentTags'];
          //   var productTypeTags = productTags['ProductTags']['ProductTypeTags'];
          //   var categoryTags = productTags['ProductTags']['CategoryTags'];
          //
          //   if(!mappings.isJsonArray(DepartmentTags) && !mappings.isJsonArray(productTypeTags)
          //       && !mappings.isJsonArray(categoryTags)){
          //         //var sizeModel = attributes[0] == 'SC' ? attributes[sizeModelIndex] : '';
          //         //Print record header and business id: EX: ST:0123
          //         errorOutputFile.write(attributes[0] + '|' + attributes[1] + '|' + attributes[3] + '\n');
          //   }
          // }
          errorOutputFile.write(attributes[0] + '|' + attributes[1] + '|' + attributes[3] + '\n');
        }
       });
    }
  }
}

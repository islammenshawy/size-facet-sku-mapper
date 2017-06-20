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
  // print process.argv
      console.time("mapping file");

      var productFeedFileName = __dirname + "/" + process.argv[2];
      var styleRecords = {};
      var productMappingOutputFileName = productFeedFileName + '_SFCs';
      var productMappingErrorOutputFile = productFeedFileName + '_SFCs_Error';

      var outputFile = fs.createWriteStream(productMappingOutputFileName, {
        flags: 'a' // 'a' means appending (old data will be preserved)
      });

      var errorOutputFile = fs.createWriteStream(productMappingErrorOutputFile, {
        flags: 'a' // 'a' means appending (old data will be preserved)
      });

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
            //Will not work, can't modify the object state..
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
  for(var record of styleRecords){
    var attributes = record.split('|');
    if(attributes[0] == 'ST'){
      console.log('Parsing product attributes for style [' + attributes[1] + ']');
      productTags = JSON.parse(attributes[styleTagsIndex]);
    }
    else if(attributes[0] == 'SC'){
      sizeModel = attributes[sizeModelIndex];
      if(sizeModel === undefined || sizeModel.trim() == ''){
        console.warn('Size model not found for record' + record);
      }
    }
    else if(attributes[0] == 'SK'){
      //console.log('Inventory status: ' + attributes[3]);
      var skuBusIdSzCodePair = {};
      var skuBusId = attributes[1];
      var sizecode = attributes[1].substring(9,13);
      skuBusIdSzCodePair[sizecode] = skuBusId;
      skuRecords.push(skuBusIdSzCodePair);
    }
  }
  // console.warn('before the get method :' + sizeModel, productTags, skuRecords);
  var SFCs = mappings.getProductSfcs(productTags, sizeModel, skuRecords, tagsSfcCache, sfcsSizeModelCache);
  if(SFCs !== undefined){
    SFCs.forEach(function(v) { outputFile.write(v + '\n'); });
  }
  else{
    styleRecords.forEach(function(v) { errorOutputFile.write(v + '\n'); });
  }
}

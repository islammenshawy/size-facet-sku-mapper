"use strict";
var Excel = require('exceljs');
var request = require('sync-request');
var sfcfilename = __dirname + "/size_facet_categories.xlsx";
var szModelfilename = __dirname + "/size_model_facets_mappings.xlsx"
var i = 1

/**
* Function to check if element is json array
**/
function isJsonArray(element) {
  return Object.prototype.toString.call(element).trim() == '[object Array]';
}

/**
* Function to convert json object to json array if it's otherwise it will just return it.
**/
function jsonObjectToArray(element){
  var jsonArray = [];
  if(!isJsonArray(element)){
    jsonArray.push(element);
  }else {
    jsonArray = element;
  }
  return jsonArray;
}

/**
** Function to build the cache key for sfcs
**/
function buildSFCsCacheTagKey(departmentTag, productTypeTag, categoryGroupTag){
  var pipe = '|';
  return departmentTag + pipe + productTypeTag + pipe + categoryGroupTag;
}

/**
** Function to build the products sfcs from the cache
**/
var getProductSfcs = function(tagsJson, sizeModel, skus, tagsCache, sizeModelCache){
  if(sizeModel === undefined || tagsJson === undefined || skus === undefined || skus.length == 0){
    //console.error('Error in one of the records, size model: ' + sizeModel + ', Tags: ' +
    //      JSON.stringify(tagsJson) + ', SKUs: ' + skus);
    return;
  }

  var results = [];
  var handledSizeModels = {};
  var validSfcs = [];

  //Make Tags Json object into array
  var departmentTags = jsonObjectToArray(tagsJson['departmentTag']);
  var productTypeTags = jsonObjectToArray(tagsJson['productTag']);
  var categoryGroupTags = jsonObjectToArray(tagsJson['categoryTag']);

  //Filter available SFCs from the first cache for product tags
  for(var departmentTag of departmentTags){
    for(var productTypeTag of productTypeTags){
      for(var categoryGroupTag of categoryGroupTags){
        var tagsKey = buildSFCsCacheTagKey(departmentTag, productTypeTag, categoryGroupTag);
        var tagValidSfcs = tagsCache[tagsKey];
        validSfcs = validSfcs.concat(tagValidSfcs);
      }
    }
  }

  if(validSfcs.filter(Boolean).length == 0){
    //console.error('Can\'t find mapping for tags' + JSON.stringify(tagsJson) + '\n'
    //+ 'SKUs -->' + JSON.stringify(skus));
    return undefined;
  }


  //Set a hashset for easy flagging and retrieval of value to make it easy instead of looping
  var validSfcsMap = {};
  for(var sfc of validSfcs){
    validSfcsMap[sfc] = sfc;
  }

  var sizeModels = sizeModelCache[sizeModel];
  for(var sizeModel of sizeModels){
    var currentSizeCode = sizeModel['sizeCode'];
    var currentSfcId = sizeModel['sfcId'];
    var currentDimension = sizeModel['dimension'];
    var isHandled = {};

    for(var skupair of skus){
      if(skupair[currentSizeCode] !== undefined
              && validSfcsMap[currentSfcId] !== undefined
                  && !handledSizeModels[skupair[currentSizeCode] + '_' + currentDimension]){
        results.push(skupair[currentSizeCode] + sizeModel['sizeFacetBreadCrumb']);
        handledSizeModels[skupair[currentSizeCode] + '_' + currentDimension] = true;
      }
    }

    if(!isHandled){
      //console.error('Can\'t find mapping for Size Code: ' + currentSizeCode);
    }
  }

  return results;
}


/**
** Function to load the size facet product tags cache from size_facet_categories.xlsx excel sheet.
**/
var loadSfcsCache = function(workbook, workbook2, sfcacheCallback, szmodelCacheCallback){
    var tagsCache = {};
    workbook.xlsx.readFile(sfcfilename)
    .then(function() {
      console.time('Facets Cache load');
      var worksheet = workbook.getWorksheet(i);
      worksheet.eachRow(function(row, rowNumber) {
        var categoryGroupTag = row.getCell('P').value.toString().trim();
        var departmentTag = row.getCell('Q').value.toString().trim();
        var productTypeTag = row.getCell('R').value.toString().trim();
        var rowSfctgId = row.getCell('A').value.toString().trim(); //Category Id Size Facet
        var cacheTagkey = buildSFCsCacheTagKey(departmentTag, productTypeTag, categoryGroupTag);
        var cacheTagValue = tagsCache[cacheTagkey];
        if(cacheTagValue !== undefined){
          var alreadyExists = false;
          for(var currentSfcId of cacheTagValue){
            if(currentSfcId == rowSfctgId){
              alreadyExists = true;
            }
          }
          if(!alreadyExists) {
            cacheTagValue.push(rowSfctgId);
          }
        }
        else{
          var cacheTagValueArray = [];
          cacheTagValueArray.push(rowSfctgId);
          tagsCache[cacheTagkey] = cacheTagValueArray;
        }
      });
      sfcacheCallback(tagsCache);
      loadSzModelSzCodeFctsCache(workbook2, szmodelCacheCallback);
      console.timeEnd('Facets Cache load');
    });
};

function buildSizeModelKey(sizeModel){
  return sizeModel;
}

/**
** Function to load the size model/size code/SFCs cache from size_model_facets_mappings.xlsx excel sheet
**/
function loadSzModelSzCodeFctsCache(workbook2, loadServerCacheCallback){
  workbook2.xlsx.readFile(szModelfilename)
    .then(function() {
      console.time('Size Cache load')
      var worksheet = workbook2.getWorksheet(i);
      var sizeModelCache = {};

      worksheet.eachRow(function(row, rowNumber) {
          var rowSizeModel = row.getCell('B').value;
          var rowsizeCode = row.getCell('C').value;
          var rowsizeFacetName = row.getCell('G').value;
          var dimension = row.getCell('E').value;
          var sfcId = row.getCell('A').value;

          // **** Size facet id/Model cache logic ***
          var cacheKey = buildSizeModelKey(rowSizeModel);
          var cacheValue = sizeModelCache[cacheKey];
          var currentBrdCrumb = buildSizeFacetBreadCrumb(row);

          //current Row from implementation.
          var currentRow = {};
          currentRow['sfcId'] = sfcId;
          currentRow['sizeCode'] = rowsizeCode;
          currentRow['sizeFacetName'] = rowsizeFacetName;
          currentRow['dimension'] = dimension;
          currentRow['sizeFacetBreadCrumb'] = currentBrdCrumb;

          //Already exists
          if(cacheValue !== undefined){
            var alreadyAdded = false;
            for(var sizeModelCurrent of cacheValue){
              if(JSON.stringify(sizeModelCurrent) == JSON.stringify(currentRow)){
                alreadyAdded = true;
              }
            }
            if(!alreadyAdded){
              cacheValue.push(currentRow);
            }
          }
          else{ //doesn't exist
              var sizeKeyArray = [];
              sizeKeyArray.push(currentRow);
              sizeModelCache[cacheKey] = sizeKeyArray;
          }
      });
      console.timeEnd('Size Cache load')
      loadServerCacheCallback(sizeModelCache);
    });
  };

/**
** Function to build the size facet breadCrumb
**/
function buildSizeFacetBreadCrumb(row){
      var sizeFacetWebName = row.getCell('H');
      var sizeFacetDimName = row.getCell('I');
      var variant = row.getCell('M');
      var dimension = row.getCell('E');
      var sizeFacetVar1Selected = row.getCell('K');
      var sizeFacetVar2Selected = row.getCell('L');
      var pipe = '|';
      var key = pipe + sizeFacetWebName + pipe + sizeFacetDimName + pipe
        + variant + pipe + sizeFacetVar1Selected + pipe + sizeFacetVar2Selected
        + pipe + 'Dim_' +dimension + pipe;
      return key;
    };

module.exports = {loadSfcsCache, loadSzModelSzCodeFctsCache, getProductSfcs};

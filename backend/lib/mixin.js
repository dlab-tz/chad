const Excel = require('exceljs');
const flatten = require('flat');
const config = require('./config');
const aggregator = require('./aggregator');
const _ = require('lodash');

module.exports = {
  getAggFormDetails(name) {
    let forms = config.getConf('aggregator:forms')
    let form = forms.find((form) => {
      return form.name === name
    })
    return form
  },
  downloadJSONForm(callback) {
    let householdFormID = config.getConf('aggregator:householdForm:id');
    aggregator.downloadJSONForm(householdFormID, callback);
  },
  getDataFromJSON(json, json_key) {
    let keys = Object.keys(json);
    if (json.hasOwnProperty(json_key)) {
      return [json[json_key], json_key];
    } else {
      let key_found = keys.find(key => {
        return key.endsWith('/' + json_key);
      });
      if (key_found) {
        return [json[key_found], key_found];
      } else {
        return [false, false];
      }
    }
  },
  getWorkbook(filename, callback) {
    let workbook = new Excel.Workbook();
    workbook.xlsx
      .readFile(filename)
      .then(() => {
        return callback(workbook);
      })
      .catch(err => {
        console.log(err);
      });
  },

  flattenSubmission(data, callback) {
    let formID = Object.keys(data)[0];
    let flattened = flatten(data[formID], {
      delimiter: '/',
      safe: true,
    });

    const promises = [];
    for (let flattenedIndex in flattened) {
      promises.push(
        new Promise((resolve, reject) => {
          if (Array.isArray(flattened[flattenedIndex])) {
            makeFlat(flattened[flattenedIndex], results => {
              flattened[flattenedIndex] = results;
              resolve();
            });
          } else {
            if (!flattened[flattenedIndex]) {
              delete flattened[flattenedIndex];
            }
            resolve();
          }
        })
      );
    }
    Promise.all(promises).then(() => {
      return callback(flattened);
    });

    function makeFlat(data, callback) {
      let results = [];
      const topPromises = [];
      for (let dt of data) {
        topPromises.push(
          new Promise((resolve, reject) => {
            const innerPromises = [];
            let flattened = flatten(dt, {
              delimiter: '/',
              safe: true,
            });
            for (let flattenedIndex in flattened) {
              innerPromises.push(
                new Promise((resolve, reject) => {
                  if (Array.isArray(flattened[flattenedIndex])) {
                    makeFlat(flattened[flattenedIndex], results => {
                      flattened[flattenedIndex] = results;
                      //console.log(JSON.stringify(flattened, 0, 2));
                      resolve();
                    });
                  } else {
                    if (!flattened[flattenedIndex]) {
                      delete flattened[flattenedIndex];
                    }
                    resolve();
                  }
                })
              );
            }
            Promise.all(innerPromises).then(() => {
              results.push(flattened);
              resolve();
            });
          })
        );
      }
      Promise.all(topPromises).then(() => {
        return callback(results);
      });
    }
  },

  // for now this function converts objects {} to arrays
  convertSubmissionToSchemaFormat(data, schemaFields, callback) {
    const promises = [];
    for (let key in data) {
      promises.push(
        new Promise((resolve, reject) => {
          if (typeof data[key] !== 'object') {
            resolve();
          } else if (Array.isArray(data[key])) {
            const promises1 = [];
            for (let dt in data[key]) {
              promises1.push(
                new Promise((resolve, reject) => {
                  this.convertSubmissionToSchemaFormat(
                    data[key][dt],
                    schemaFields,
                    () => {
                      resolve();
                    }
                  );
                })
              );
            }
            Promise.all(promises1).then(() => {
              resolve();
            });
          } else {
            getKey(key, schemaFields, schemaObj => {
              if (
                Array.isArray(schemaObj) &&
                !Array.isArray(data[key]) &&
                typeof data[key] === 'object'
              ) {
                let objCopy = _.cloneDeep(data[key]);
                data[key] = [objCopy];
                this.convertSubmissionToSchemaFormat(
                  data[key][0],
                  schemaFields,
                  () => {
                    resolve();
                  }
                );
              } else if (
                typeof data[key] === 'object' &&
                !Array.isArray(data[key])
              ) {
                this.convertSubmissionToSchemaFormat(
                  data[key],
                  schemaFields,
                  () => {
                    resolve();
                  }
                );
              } else {
                resolve();
              }
            });
          }
        })
      );
    }
    Promise.all(promises).then(() => {
      return callback();
    });

    function getKey(searchKey, searchFrom, callback) {
      let searchResults;
      const promises = [];
      for (let key in searchFrom) {
        promises.push(
          new Promise(resolve => {
            if (key == searchKey) {
              searchResults = searchFrom[key];
              resolve();
            } else if (typeof searchFrom[key] == 'object') {
              getKey(searchKey, searchFrom[key], keyMatch => {
                if (keyMatch) {
                  searchResults = keyMatch;
                }
                resolve();
              });
            } else {
              resolve();
            }
          })
        );
      }

      Promise.all(promises).then(() => {
        return callback(searchResults);
      });
    }
  },
};

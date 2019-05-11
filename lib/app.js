require('./init');
const express = require('express')
const winston = require('winston')
const request = require('request')
const async = require('async')
const Excel = require('exceljs')
const googleSheets = require('./google')
const aggregator = require('./aggregator')
const config = require('./config');
const URI = require('urijs')
const port = config.getConf('server:port')
const app = express()

app.all('/populateData', (req, res) => {
  let householdFormID = config.getConf("aggregator:householdForm:id")
  let householdFormName = config.getConf("aggregator:householdForm:name")
  winston.info("Received a request to update houses in XLSForm")
  aggregator.downloadXLSForm(householdFormID, householdFormName, (err) => {
    if(err) {
      return res.status(500).send()
    }
    aggregator.downloadFormData(householdFormID, (err, formData) => {
      try {
        formData = JSON.parse(formData)
      } catch (error) {
        winston.error(error)
        winston.error("invalid data returned by aggregator, stop updating villages")
        return res.status(500).send()
      }
      getWorkbook(__dirname + '/' + householdFormName + '.xlsx', (chadWorkbook) => {
        //loop through online aggregator formData and compare against 
        async.each(formData, (data, nxt) => {
          let keys = Object.keys(data)
          let pregnant_wom_name, pregnant_wom_age,pregnant_wom_name_new, pregnant_wom_age_new
          if(keys.includes('pregnant_woman_name_new')) {
            pregnant_wom_name_new = data['pregnant_woman_name_new']
          } else {
            let preg_name_key = getKeys(keys, 'pregnant_woman_name_new')
            if (preg_name_key) {
              pregnant_wom_name_new = data[preg_name_key]
            }
          }
          if(keys.includes('pregnant_woman_name')) {
            pregnant_wom_name = data['pregnant_woman_name']
          } else {
            let preg_name_key = getKeys(keys, 'pregnant_woman_name')
            if (preg_name_key) {
              pregnant_wom_name = data[preg_name_key]
            }
          }
          if(keys.includes('pregnant_woman_age_new')) {
            pregnant_wom_age_new = data['pregnant_woman_age_new']
          } else {
            let preg_age_key = getKeys(keys, 'pregnant_woman_age_new')
            if (preg_age_key) {
              pregnant_wom_age_new = data[preg_age_key]
            }
          }
          if(data.house_name != 'add_new' && pregnant_wom_name != 'add_new') {
            return nxt()
          }
          let house_name = data.house_name_new
          let house_number = data.house_number_new
          if(data.house_name != 'add_new') {
            house_number = data.house_name.split('-').pop()
            house_name = data.house_name.split('-')[0]
          }
          let chadChoicesWorksheet = chadWorkbook.getWorksheet('choices')
          let add_preg_woman, add_house
          if(pregnant_wom_name == 'add_new') {
            add_preg_woman = true
          }
          if(data.house_name == 'add_new') {
            add_house = true
          }
          const chadPromises = []
          chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
            chadPromises.push(new Promise((resolve, reject) => {
              if(!chadRows.values.includes('house_name') && !chadRows.values.includes('pregnant_women')) {
                return resolve()
              }
              if(chadRows.values.includes('house_name') && chadRows.values.includes(house_name + ' - ' + house_number)) {
                add_house = false
              }
              let preg_wom_label = pregnant_wom_name_new + ' - ' + pregnant_wom_age_new + ' - ' + house_number
              if(chadRows.values.includes('pregnant_women') && chadRows.values.includes(preg_wom_label)) {
                add_preg_woman = false
              }
              return resolve()
            }))
          })
          Promise.all(chadPromises).then(() => {
            async.series({
              house: (callback) => {
                if(add_house) {
                  let lastRow = chadChoicesWorksheet.lastRow
                  let getRowInsert = chadChoicesWorksheet.getRow(++(lastRow.number))
                  getRowInsert.getCell(1).value = 'house_name'
                  getRowInsert.getCell(2).value = house_number
                  getRowInsert.getCell(3).value = house_name + ' - ' + house_number
                  getRowInsert.getCell(4).value = data['village']
                  getRowInsert.commit()
                  return callback(null, null)
                } else {
                  return callback(null, null)
                }
              },
              preg_wom: (callback) => {
                if(add_preg_woman) {
                  let lastRow = chadChoicesWorksheet.lastRow
                  let getRowInsert = chadChoicesWorksheet.getRow(++(lastRow.number))
                  getRowInsert.getCell(1).value = 'pregnant_women'
                  getRowInsert.getCell(2).value = pregnant_wom_name_new + ' - ' + pregnant_wom_age_new + ' - ' + house_number
                  getRowInsert.getCell(3).value = pregnant_wom_name_new + ' - ' + pregnant_wom_age_new + ' - ' + house_number
                  getRowInsert.getCell(4).value = house_number
                  getRowInsert.commit()
                  return callback(null, null)
                } else {
                  return callback(null, null)
                }
              }
            }, (err, results) => {
              return nxt()
            })
          }).catch((err) => {
            winston.error(err)
          })
        }, () => {
          winston.info('writting any changes into local household_visit XLSForm')
          chadWorkbook.xlsx.writeFile(__dirname + '/' + householdFormName + '.xlsx').then(() => {
            winston.info('Updating the online CHAD XLSForm with the local household XLSForm')
            aggregator.publishForm(householdFormID, householdFormName, () => {
              winston.info('Online household XLSForm Updated')
              res.status(200).send()
            })
          })
        })
      })
    })
  })

  function getKeys(keys, key_name) {
    let key_found = keys.find((key) => {
      return key.endsWith('/' + key_name)
    })
    return key_found
  }
  function getWorkbook(filename, callback) {
    let workbook = new Excel.Workbook()
    workbook.xlsx.readFile(filename).then(() => {
      return callback(workbook)
    }).catch((err) => {
      console.log(err)
    })
  }
})
app.all('/updateVillages', (req, res) => {
  let username = config.getConf("aggregator:user")
  let password = config.getConf("aggregator:password")
  let host = config.getConf("aggregator:host")
  let housesFormID = config.getConf("aggregator:housesForm:id")
  let auth = "Basic " + new Buffer(username + ":" + password).toString("base64")
  let url = new URI(host).segment("/api/v1/data").segment(housesFormID).toString()
  let options = {
    url: url,
    headers: {
      Authorization: auth
    }
  }
  request.get(options, (err, reslts, body) => {
    try {
      body = JSON.parse(body)
    } catch (error) {
      winston.error(error)
      winston.error("invalid data returned by aggregator, stop updating villages")
      res.status(500).send()
    }
    async.each(body, (data, nxt) => {
      let keys = Object.keys(data)
      let key_name = keys.find((key) => {
        return key.endsWith('house_name')
      })
      let key_number = keys.find((key) => {
        return key.endsWith('house_number')
      })
      let house_name, house_number
      if(key_name) {
        house_name = data[key_name]
      }
      if(key_number) {
        house_number = data[key_number]
      }

      let spreadsheetId = config.getConf("google:spreadsheetId")
      googleSheets.getSpreadsheetData(spreadsheetId, "choices", (err, sheetData) => {
        if (err) {
          winston.error(err);
        } else {
          let houseExist = false
          async.each(sheetData, (row, nxtRow) => {
            if(row[0] !== 'house_name') {
              return nxtRow()
            }
            if(row[2] == house_name + ' - ' + house_number) {
              houseExist = true
            }
            return nxtRow()
          }, () => {
            if(!houseExist) {
              let spreadsheetId = config.getConf("google:spreadsheetId")
              let row = [
                ['house_name', house_number, house_name + ' - ' + house_number, data['village']]
              ]
              googleSheets.addRow(spreadsheetId, 'choices', row)
            }
            return nxt()
          })
        }
      })

    })
  })
})

app.listen(port, () => {
  winston.info("Server is running and listening on port " + port)
})
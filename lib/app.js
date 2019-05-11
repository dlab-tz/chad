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

app.all('/test', (req, res) => {
  let housesFormID = config.getConf("aggregator:housesForm:id")
  let housesFormName = config.getConf("aggregator:housesForm:name")
  let chadFormID = config.getConf("aggregator:chadForm:id")
  let chadFormName = config.getConf("aggregator:chadForm:name")
  winston.info("Received a request to update houses in XLSForm")
  aggregator.downloadXLSForm(housesFormID, housesFormName, (err) => {
    if(err) {
      return res.status(500).send()
    }
    aggregator.downloadXLSForm(chadFormID, chadFormName, (err) => {
      if(err) {
        return res.status(500).send()
      }
      aggregator.downloadJSONForm(housesFormID, (err, xlsForm) => {
        if(err) {
          return res.status(500).send()
        }
        try {
          xlsForm = JSON.parse(xlsForm)
        } catch (error) {
          winston.error(error)
          return res.status(500).send()
        }
        aggregator.downloadFormData(housesFormID, (err, formData) => {
          try {
            formData = JSON.parse(formData)
          } catch (error) {
            winston.error(error)
            winston.error("invalid data returned by aggregator, stop updating villages")
            return res.status(500).send()
          }
          getWorkbook(__dirname + '/' + housesFormName + '.xlsx', (workbook) => {
            let worksheet = workbook.getWorksheet('choices')
            //loop through online aggregator formData and compare against 
            async.each(formData, (data, nxt) => {
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
              
              getWorkbook(__dirname + '/' + chadFormName + '.xlsx', (chadWorkbook) => {
                let chadChoicesWorksheet = chadWorkbook.getWorksheet('choices')
                let row_exists = false
                const chadPromises = []
                chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
                  chadPromises.push(new Promise((resolve, reject) => {
                    if(!chadRows.values.includes('house_name')) {
                      return resolve()
                    }
                    if(chadRows.values.includes(house_name + ' - ' + house_number)) {
                      row_exists = true
                    }
                    return resolve()
                  }))
                })
                Promise.all(chadPromises).then(() => {
                  if(!row_exists) {
                    let lastRow = chadChoicesWorksheet.lastRow
                    let getRowInsert = chadChoicesWorksheet.getRow(++(lastRow.number))
                    async.eachOf(housesRows.values, (value, index, nxtValue) => {
                      if(!value) {
                        return nxtValue()
                      }
                      getRowInsert.getCell(index).value = value
                      getRowInsert.commit()
                      return nxtValue()
                    }, () => {
                      return nxt()
                    })
                  } else {
                    return nxt()
                  }
                }).catch((err) => {
                  winston.error(err)
                })
              })
            }, () => {
              winston.info('writting any changes into local household_visit XLSForm')
              chadWorkbook.xlsx.writeFile(__dirname + '/' + chadFormName + '.xlsx').then(() => {
                winston.info('Updating the online CHAD XLSForm with the local household XLSForm')
                aggregator.publishForm(chadFormID, chadFormName, () => {
                  winston.info('Online household XLSForm Updated')
                })
              })
            })
          })
        })
      })
    })
  })

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
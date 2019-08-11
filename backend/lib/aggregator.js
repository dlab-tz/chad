require('./init')
const request = require("request")
const winston = require('winston')
const config = require('./config')
const mixin = require('./mixin')
const URI = require('urijs')
const fs = require('fs')

const publishForm = (formId, formName, callback) => {
  let token = config.getConf("aggregator:token")
  let host = config.getConf("aggregator:host")
  let url = new URI(host).segment("/api/v1/forms").segment(formId).toString()
  let options = {
    url: url,
    headers: {
      Authorization: `Token ${token}`
    },
    formData: {
      xls_file: fs.createReadStream(__dirname + '/household_visit.xlsx')
    }
  }
  request.patch(options, (err, res, body) => {
    if (err) {
      winston.error(err)
    }
    return callback()
  })
}

const addLocationToXLSForm = (id, name, parent, type, callback) => {
  let householdFormID = config.getConf("aggregator:householdForm:id")
  let householdFormName = config.getConf("aggregator:householdForm:name")
  downloadXLSForm(householdFormID, householdFormName, (err) => {
    mixin.getWorkbook(__dirname + '/' + householdFormName + '.xlsx', (chadWorkbook) => {
      let chadChoicesWorksheet = chadWorkbook.getWorksheet('choices')
      let lastRow = chadChoicesWorksheet.lastRow
      let getRowInsert = chadChoicesWorksheet.getRow(++(lastRow.number))
      if (!parent) {
        parent = ''
      }
      getRowInsert.getCell(1).value = type
      getRowInsert.getCell(2).value = id
      getRowInsert.getCell(3).value = name
      getRowInsert.getCell(4).value = name
      getRowInsert.getCell(5).value = parent
      getRowInsert.commit()
      winston.info('writting new house into local household_visit XLSForm')
      chadWorkbook.xlsx.writeFile(__dirname + '/' + householdFormName + '.xlsx').then(() => {
        winston.info('Updating the online CHAD XLSForm with the local household XLSForm')
        publishForm(householdFormID, householdFormName, () => {
          winston.info('Online household XLSForm Updated')
          return callback()
        })
      })
    })
  })
}

const downloadXLSForm = (formId, formName, callback) => {
  winston.info('Getting online XLSForm in XLS format...')
  let token = config.getConf("aggregator:token")
  let host = config.getConf("aggregator:host")
  let url = new URI(host).segment("/api/v1/forms/" + formId + '/form.xls').toString()
  let options = {
    url: url,
    headers: {
      Authorization: `Token ${token}`
    }
  }
  let status = request.get(options)
    .on('error', (err) => {
      winston.error(err)
      winston.error("An error occured while downloading XLSForm")
      return callback(err)
    })
    .pipe(fs.createWriteStream(__dirname + '/' + formName + '.xlsx'))

  status.on('finish', () => {
    winston.info("Finished downloading XLSForm in XLS Format")
    return callback(false)
  })
}

const downloadJSONForm = (formId, callback) => {
  winston.info('Getting online XLSForm in JSON format')
  let username = config.getConf("aggregator:user")
  let password = config.getConf("aggregator:password")
  let host = config.getConf("aggregator:host")
  let auth = "Basic " + new Buffer(username + ":" + password).toString("base64")
  let url = new URI(host).segment("/api/v1/forms").segment(formId).segment('form.json').toString()
  let options = {
    url: url,
    headers: {
      Authorization: auth
    }
  }
  request.get(options, (err, res, body) => {
    winston.info("Finished downloading XLSForm in JSON Format")
    if (err) {
      winston.error(err)
    }
    return callback(err, body)
  })
}

const downloadFormData = (formId, callback) => {
  let username = config.getConf("aggregator:user")
  let password = config.getConf("aggregator:password")
  let host = config.getConf("aggregator:host")
  let auth = "Basic " + new Buffer(username + ":" + password).toString("base64")
  let url = new URI(host).segment("/api/v1/data").segment(formId).toString()
  let options = {
    url: url,
    headers: {
      Authorization: auth
    }
  }
  winston.info('fetching data from aggregator')
  request.get(options, (err, reslts, formData) => {
    if (err) {
      winston.error(err)
    }
    return callback(err, formData)
  })
}

const populateHouses = (chadChoicesWorksheet, house_name, house_number, village, callback) => {
  let lastRow = chadChoicesWorksheet.lastRow
  let getRowInsert = chadChoicesWorksheet.getRow(++(lastRow.number))
  getRowInsert.getCell(1).value = 'house_name'
  getRowInsert.getCell(2).value = house_number
  getRowInsert.getCell(3).value = house_name + ' - ' + house_number
  getRowInsert.getCell(4).value = house_name + ' - ' + house_number
  getRowInsert.getCell(5).value = village
  getRowInsert.commit()
  return callback(false)
}

const populatePregnantWomen = (chadChoicesWorksheet, pregnant_wom_name, pregnant_wom_age, house_number, callback) => {
  let lastRow = chadChoicesWorksheet.lastRow
  let getRowInsert = chadChoicesWorksheet.getRow(++(lastRow.number))
  getRowInsert.getCell(1).value = 'pregnant_women'
  getRowInsert.getCell(2).value = pregnant_wom_name + ' - ' + pregnant_wom_age + ' - ' + house_number
  getRowInsert.getCell(3).value = pregnant_wom_name + ' - ' + pregnant_wom_age + ' - ' + house_number
  getRowInsert.getCell(4).value = pregnant_wom_name + ' - ' + pregnant_wom_age + ' - ' + house_number
  getRowInsert.getCell(5).value = house_number
  getRowInsert.commit()
  return callback(false)
}

const createAccount = (details, callback) => {
  let formId = config.getConf("aggregator:householdForm:id")
  let profile = {
    username: details.odkUsername,
    password: details.surname,
    first_name: details.firstName,
    last_name: details.surname,
    email: details.email
  }
  let token = config.getConf("aggregator:token")
  let host = config.getConf("aggregator:host")
  let url = new URI(host).segment("/api/v1/profiles").toString()
  let options = {
    url: url,
    headers: {
      Authorization: `Token ${token}`
    },
    body: profile,
    json: true
  }
  request.post(options, (err, res, body) => {
    if (err) {
      winston.error(err)
    }
    shareFormWithUser(formId, details.odkUsername, () => {
      return callback()
    })
  })
}

const shareFormWithUser = (formId, username, callback) => {
  let token = config.getConf("aggregator:token")
  let host = config.getConf("aggregator:host")
  let url = new URI(host).segment(`/api/v1/forms/${formId}/share`).toString()
  let options = {
    url: url,
    headers: {
      Authorization: `Token ${token}`
    },
    body: {
      username: username,
      role: 'dataentry'
    },
    json: true
  }
  request.post(options, (err, res, body) => {
    if (err) {
      winston.error(err)
    }
    return callback()
  })
}

module.exports = {
  addLocationToXLSForm,
  publishForm,
  downloadXLSForm,
  downloadJSONForm,
  downloadFormData,
  populateHouses,
  populatePregnantWomen,
  createAccount,
  shareFormWithUser
}
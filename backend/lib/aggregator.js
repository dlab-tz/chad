require('./init')
const request = require("request")
const winston = require('winston')
const config = require('./config')
const URI = require('urijs')
const fs = require('fs')

const publishForm = (formId, formName, callback) => {
  let username = config.getConf("aggregator:user")
  let password = config.getConf("aggregator:password")
  let host = config.getConf("aggregator:host")
  let auth = "Basic " + new Buffer(username + ":" + password).toString("base64")
  let url = new URI(host).segment("/api/v1/forms").segment(formId).toString()
  let options = {
    url: url,
    headers: {
      Authorization: auth
    },
    formData: {
      xls_file: fs.createReadStream(__dirname + '/' + formName + '.xlsx')
    }
  }
  request.patch(options, (err, res, body) => {
    return callback()
  })
}

const downloadXLSForm = (formId, formName, callback) => {
  winston.info('Getting online XLSForm in XLS format...')
  let username = config.getConf("aggregator:user")
  let password = config.getConf("aggregator:password")
  let host = config.getConf("aggregator:host")
  let auth = "Basic " + new Buffer(username + ":" + password).toString("base64")
  let url = new URI(host).segment("/api/v1/forms/" + formId + '/form.xls').toString()
  let options = {
    url: url,
    headers: {
      Authorization: auth
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
    if(err) {
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
    if(err) {
      winston.error(err)
    }
    return callback(err, formData)
  })
}

module.exports = {
  publishForm,
  downloadXLSForm,
  downloadJSONForm,
  downloadFormData
}
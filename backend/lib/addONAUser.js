require('./init')
const request = require("request")
const winston = require('winston')
const config = require('./config')
const URI = require('urijs')
require('./connection')
const async = require('async')
const models = require('./models')

models.CHAModel.find({}).lean().exec({}, (err, data) => {
  async.each(data, (dt, nxtDt) => {
    let details = {
      odkUsername: dt.odkUsername,
      surname: dt.surname,
      firstName: dt.firstName,
      email: dt.email
    }
    winston.error(JSON.stringify(dt))
    // createAccount(details, () => {
    //   return nxtDt()
    //   console.log('Account created')
    // })
  })
});

function createAccount(details, callback) {
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
    winston.info(body)
    if (err) {
      winston.error(err)
    }
    shareFormWithUser(formId, details.odkUsername, () => {
      return callback()
    })
  })
}

function shareFormWithUser(formId, username, callback) {
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
    winston.error(body)
    if (err) {
      winston.error(err)
    }
    return callback()
  })
}
require('./init');
const winston = require('winston')
const request = require('request')
const URI = require('urijs')
const config = require('./config');

const isThrottled = (results,callback) => {
  if(!results) {
    winston.error("An error has occured while checking throttling,empty rapidpro results were received")
    return callback(true)
  }
  if(results.hasOwnProperty("detail")) {
    var detail = results.detail.toLowerCase()
    if(detail.indexOf("throttled") != -1) {
      var detArr = detail.split(" ")
      async.eachSeries(detArr,(det,nxtDet)=>{
        if(!isNaN(det)) {
          //add 5 more seconds on top of the wait time expected by rapidpro then convert to miliseconds
          var wait_time = (parseInt(det) *1000) + 5
          winston.warn("Rapidpro has throttled my requests,i will wait for " + wait_time/1000 + " Seconds Before i proceed,please dont interrupt me")
          setTimeout(function() {
            return callback(true)
          }, wait_time)
        }
        else
          return nxtDet()
      },function(){
        return callback(false)
      })
    }
    else
    return callback(false)
  }
  else {
    callback(false)
  }
}

const addContact = (contact, callback) => {
  let host = config.getConf('rapidpro:host')
  let token = config.getConf('rapidpro:token')
  let url = URI(host).segment('api/v2/contacts.json').toString()
    if(contact.hasOwnProperty("uuid"))
    url = url + "?uuid=" + contact.uuid

    let options = {
      url: url,
      headers: {
        Authorization: `Token ${token}`
      },
      body: contact,
      json: true
    }
    request.post(options, (err, res, newContact) => {
      if (err) {
        winston.error(err)
        return callback(err)
      }
      isThrottled(newContact,(wasThrottled) => {
        if(wasThrottled) {
          //reprocess this contact
          addContact(contact, (err, newContact) => {
            return callback(err,newContact)
          })
        }
        else {
          if(!newContact.hasOwnProperty("uuid")) {
            winston.error("An error occured while adding contact " + JSON.stringify(newContact))
            return callback(true, newContact)
          }

          
          return callback(null, newContact)
        }
      })
    })
  }

  module.exports = {
    addContact
  }
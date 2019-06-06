require('./init');
const winston = require('winston')
const request = require('request')
const async = require('async')
const mongo = require('./mongo')()
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
  const alertReferal = (CHAUsername, sms) => {
    mongo.getCHAByUsername(CHAUsername, (err, cha) => {
      if(err) {
        winston.error(err)
        return
      }
      if(cha.length == 0) {
        return
      }
      let villageId = cha[0].village
      mongo.getFacilityFromVillage(villageId, (err, facility) => {
        if(err) {
          winston.error(err)
          return
        }
        try {
          facility = JSON.parse(JSON.stringify(facility))
        } catch (error) {
          winston.error(error) 
        }
        if(facility.length == 0) {
          return
        }
        let facilityId = facility[0]._id
        mongo.getHFS(facilityId, (err, HFSs) => {
          try {
            HFSs = JSON.parse(JSON.stringify(HFSs))
          } catch (error) {
            winston.error(error) 
          }
          if(HFSs.length == 0) {
            return
          }
          rp_ids = []
          async.each(HFSs, (hfs, nxtHfs) => {
            if(hfs.rapidproId) {
              rp_ids.push(hfs.rapidproId)
              return nxtHfs()
            } else {
              return nxtHfs()
            }
          }, () => {
            if(rp_ids.length > 0) {
              broadcast(rp_ids, sms)
            }
          })
        })
      })
    })
  }
  const broadcast = (rapidpro_id, sms) => {
    winston.error(rapidpro_id)
    if(!Array.isArray(rapidpro_id)) {
      winston.error("cant send broadcast message, rapidpro_id is not an array of ids")
      return
    }
    let host = config.getConf('rapidpro:host')
    let token = config.getConf('rapidpro:token')
    let url = URI(host).segment('api/v2/broadcasts.json').toString()
    let options = {
      url: url,
      headers: {
        Authorization: `Token ${token}`
      },
      body: {
        "contacts": rapidpro_id,
        "text": sms
      },
      json: true
    }
    request.post(options, (err, res, body) => {
      winston.error(body)
      winston.info("Broadcast msg sent successfully")
    })
  }

  module.exports = {
    addContact,
    alertReferal
  }
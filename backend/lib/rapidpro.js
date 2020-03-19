require('./init');
const winston = require('winston')
const request = require('request')
const async = require('async')
const mongo = require('./mongo')()
const models = require('./models')
const URI = require('urijs')
const config = require('./config')

const mongoUser = config.getConf("DB_USER")
const mongoPasswd = config.getConf("DB_PASSWORD")
const mongoHost = config.getConf("DB_HOST")
const mongoPort = config.getConf("DB_PORT")
const database = config.getConf("DB_NAME")
let mongoURI
if (mongoUser && mongoPasswd) {
  mongoURI = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
} else {
  mongoURI = `mongodb://${mongoHost}:${mongoPort}/${database}`;
}

const isThrottled = (results, callback) => {
  if (!results) {
    winston.error("An error has occured while checking throttling,empty rapidpro results were received")
    return callback(true)
  }
  if (results.hasOwnProperty("detail")) {
    var detail = results.detail.toLowerCase()
    if (detail.indexOf("throttled") != -1) {
      var detArr = detail.split(" ")
      async.eachSeries(detArr, (det, nxtDet) => {
        if (!isNaN(det)) {
          //add 5 more seconds on top of the wait time expected by rapidpro then convert to miliseconds
          var wait_time = (parseInt(det) * 1000) + 5
          winston.warn("Rapidpro has throttled my requests,i will wait for " + wait_time / 1000 + " Seconds Before i proceed,please dont interrupt me")
          setTimeout(function () {
            return callback(true)
          }, wait_time)
        } else
          return nxtDet()
      }, function () {
        return callback(false)
      })
    } else
      return callback(false)
  } else {
    callback(false)
  }
}

const addContact = (contact, callback) => {
  let host = config.getConf('rapidpro:host')
  let token = config.getConf('rapidpro:token')
  let url = URI(host).segment('api/v2/contacts.json').toString()
  if (contact.hasOwnProperty("uuid"))
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
    isThrottled(newContact, (wasThrottled) => {
      if (wasThrottled) {
        //reprocess this contact
        addContact(contact, (err, newContact) => {
          return callback(err, newContact)
        })
      } else {
        if (!newContact.hasOwnProperty("uuid")) {
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
    if (err) {
      winston.error(err)
      return
    }
    if (cha.length == 0) {
      winston.error('CHA details not found, cant send referral for ' + CHAUsername)
      return
    }
    let villageId = cha[0].village
    let CHAName = cha[0].firstName + ' ' + cha[0].surname
    let CHANumber = cha[0].phone1
    sms += `\\n CHA: ${CHAName}-${CHANumber}`
    mongo.getFacilityFromVillage(villageId, (err, villageDetails) => {
      if (err) {
        winston.error(err)
        return
      }
      try {
        villageDetails = JSON.parse(JSON.stringify(villageDetails))
      } catch (error) {
        winston.error(error)
      }
      if (villageDetails.length == 0) {
        winston.error('Village details not found, cant send referral for Village ' + villageId)
        return
      }
      let facilityId = villageDetails[0].parent
      mongo.getHFS(facilityId, (err, HFSs) => {
        try {
          HFSs = JSON.parse(JSON.stringify(HFSs))
        } catch (error) {
          winston.error(error)
        }
        if (HFSs.length == 0) {
          winston.error('No HFS found, cant send referral for facility ID' + facilityId)
          return
        }
        let rp_ids = []
        async.each(HFSs, (hfs, nxtHfs) => {
          if (hfs.rapidproId) {
            rp_ids.push(hfs.rapidproId)
            return nxtHfs()
          } else {
            return nxtHfs()
          }
        }, () => {
          if (rp_ids.length > 0) {
            broadcast({
              rapidpro_id: rp_ids,
              sms
            })
          } else {
            winston.error('No rapidpro ID to send referral SMS for village ' + villageDetails.name)
          }
        })
      })
    })
  })
}
const clinicReminder = (callback) => {
  let today = new Date().toISOString().substr(0, 10)
  let query = {
    nxtClinicAlert: today,
    expectedDeliveryDate: {
      '$gt': today
    }
  }
  const mongoose = require('mongoose')
  mongoose.connect(mongoURI, {}, () => {
    models.PregnantWomenModel.find(query, (err, data) => {
      if (err) {
        winston.error(err)
        return callback(true)
      }
      try {
        data = JSON.parse(JSON.stringify(data))
      } catch (error) {
        winston.error(error)
        return callback(true)
      }
      if (data.length == 0) {
        return callback(false)
      }

      let clinicDate = moment(today).add(2, 'days').format("DD-MM-YYYY")
      async.each(data, (pregWom, nxtPregWom) => {
        let sms = `${pregWom.fullName} of house ${pregWom.house} needs to attend clinic on ${clinicDate}, go and remind her`
        alertAllCHA(pregWom.village, sms)
        return callback(false)
      })
    })
  })
}

const alertAllCHA = (villageId, sms) => {
  mongo.getCHAByVillage(villageId, (err, CHAs) => {
    if (err) {
      winston.error(err)
      return
    }
    if (CHAs.length == 0) {
      return
    }
    let rp_ids = []
    async.each(CHAs, (cha, nxtCha) => {
      if (cha.rapidproId) {
        rp_ids.push(cha.rapidproId)
        return nxtCha()
      } else {
        return nxtCha()
      }
    }, () => {
      if (rp_ids.length > 0) {
        broadcast({
          rapidpro_id: rp_ids,
          sms
        })
      }
    })
  })
}

const alertCHA = (username, sms) => {
  mongo.getCHAByUsername(username, (err, cha) => {
    if (err) {
      winston.error(err)
      return
    }
    if (cha.length == 0) {
      winston.error('CHA details not found, cant send referral for ' + username)
      return
    }
    let RPID = cha[0].rapidproId
    broadcast({
      rapidpro_id: [RPID],
      sms
    })
  })
}

const broadcast = ({
  rapidpro_id,
  tels,
  sms
}) => {
  if (rapidpro_id && !Array.isArray(rapidpro_id)) {
    winston.error("cant send broadcast message, rapidpro_id is not an array of ids")
    return
  }
  if (tels && !Array.isArray(tels)) {
    winston.error("cant send broadcast message, URNS is not an array of ids")
    return
  }
  let host = config.getConf('rapidpro:host')
  let token = config.getConf('rapidpro:token')
  let url = URI(host).segment('api/v2/broadcasts.json').toString()
  let broadcastBody = {}
  if (rapidpro_id) {
    broadcastBody.contacts = rapidpro_id
  }
  if (tels) {
    broadcastBody.urns = tels
  }
  broadcastBody.text = sms
  let options = {
    url: url,
    headers: {
      Authorization: `Token ${token}`
    },
    body: broadcastBody,
    json: true
  }
  request.post(options, (err, res, body) => {
    if(err) {
      winston.error(err)
    }
    winston.info(body)
    winston.info("Broadcast msg sent successfully")
  })
}

module.exports = {
  addContact,
  alertReferal,
  alertAllCHA,
  alertCHA,
  clinicReminder,
  broadcast
}
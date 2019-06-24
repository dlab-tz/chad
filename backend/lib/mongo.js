require('./init')
const moment = require('moment')
const mongoose = require('mongoose')
const Schema = mongoose.Schema;
const winston = require('winston')
const async = require('async')
const aggregator = require('./aggregator')
const models = require('./models')
const config = require('./config')

const database = config.getConf("DB_NAME")
const mongoUser = config.getConf("DB_USER")
const mongoPasswd = config.getConf("DB_PASSWORD")
const mongoHost = config.getConf("DB_HOST")
const mongoPort = config.getConf("DB_PORT")

if (mongoUser && mongoPasswd) {
  var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
} else {
  var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
}

module.exports = function () {
  return {
    resetPassword(id, password, callback) {
      const mongoose = require('mongoose')
      mongoose.connect(uri, {}, () => {
        models.UsersModel.findByIdAndUpdate(id, {
          password: password
        }, (err, data) => {
          if (err) {
            return callback(err);
          }
          return callback(false, data)
        });
      })
    },
    updateCHARapidproId (chadid, uuid, callback) {
      const mongoose = require('mongoose')
      mongoose.connect(uri, {}, () => {
        models.CHAModel.findByIdAndUpdate(chadid, {
          rapidproId: uuid
        }, (err, data) => {
          if (err) {
            return callback(err);
          }
          return callback(false, data)
        });
      })
    },
    updateHFSRapidproId (chadid, uuid, callback) {
      const mongoose = require('mongoose')
      mongoose.connect(uri, {}, () => {
        models.HFSModel.findByIdAndUpdate(chadid, {
          rapidproId: uuid
        }, (err, data) => {
          if (err) {
            return callback(err);
          }
          return callback(false, data)
        });
      })
    },
    saveSubmission (submission) {
      if (mongoUser && mongoPasswd) {
        var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
      } else {
        var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
      }
      let householdFormID = config.getConf("aggregator:householdForm:id")
      let schemaFields = {}
      aggregator.downloadJSONForm(householdFormID, (err, householdForm) => {
        householdForm = JSON.parse(householdForm)
        async.each(submission.children, (field, nxtField) => {
          getFormField(field, schemaFields, () => {
            return nxtField()
          })
        }, () => {
          winston.error(JSON.stringify(schemaFields))
          let submissionSchema = new mongoose.Schema(schemaFields)
          let SubmissionModel = mongoose.model('Submissions', submissionSchema)
          let newSubmission = new SubmissionModel()
          newSubmission.start = '2019-06-10'
          newSubmission.username = 'ashaban'
          mongoose.connect(uri, {}, () => {
            newSubmission.save()
          })
        })
      })
    },
    addPregnantWoman (house, fullName, age, last_clin_vis, last_menstrual, cha_username) {
      if (mongoUser && mongoPasswd) {
        var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
      } else {
        var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
      }
      this.getCHAByUsername(cha_username, (err, cha) => {
        if(err) {
          winston.error(err)
          return
        }
        if(cha.length == 0) {
          return
        }
        let villageId = cha[0].village
        let expected_delivery = ''
        if(last_menstrual) {
          expected_delivery = moment(last_menstrual).add(7, "days").add(9, "M").format("YYYY-MM-DD")
        }
        let nxt_clinic_alert = ''
        if(last_clin_vis) {
          nxt_clinic_alert = moment(last_clin_vis).add(1, "M").subtract("2", "days").format("YYYY-MM-DD")
        }
        mongoose.connect(uri, {}, () => {
          let PregnantWoman = new models.PregnantWomenModel({
            house: house,
            village: villageId,
            fullName: fullName,
            age: age,
            nxtClinicAlert: nxt_clinic_alert,
            expectedDeliveryDate: expected_delivery
          })
          PregnantWoman.save((err, data) => {
            if (err) {
              winston.error(err)
              res.status(500).json({
                error: "Internal error occured"
              })
            } else {
              winston.info("Pregnant Woman saved successfully")
              return
            }
          })
        })
      })
    },
    updatePregnantWoman (house, fullName, age, last_clin_vis, last_menstrual, cha_username) {
      if (mongoUser && mongoPasswd) {
        var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
      } else {
        var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
      }
      this.getCHAByUsername(cha_username, (err, cha) => {
        if(err) {
          winston.error(err)
          return
        }
        if(cha.length == 0) {
          return
        }
        let villageId = cha[0].village
        models.PregnantWomenModel.find({'village': villageId, house: house, fullName: fullName, age: age}, (err, data) => {
          try {
            data = JSON.parse(JSON.stringify(data))
          } catch (error) {
            winston.error(error)
          }
          if(data.length > 0) {
            let exist_last_clin_vis = data[0].last_clin_vis
            let exist_last_menstrual = data[0].last_menstrual
            let updateQuery = {}
            if(!exist_last_clin_vis && last_clin_vis) {
              let nxt_clinic_alert = moment(last_clin_vis).add(1, "M").subtract("2", "days").format("YYYY-MM-DD")
              updateQuery.nxtClinicAlert = nxt_clinic_alert
            }
            if(!exist_last_menstrual && last_menstrual) {
              let expected_delivery = moment(last_menstrual).add(7, "days").add(9, "M").format("YYYY-MM-DD")
              updateQuery.expectedDeliveryDate = expected_delivery
            }
            if(Object.keys(updateQuery).length > 0) {
              mongoose.connect(uri, {}, () => {
                models.PregnantWomenModel.findByIdAndUpdate(data[0]._id, updateQuery, (err, data) => {
                  if(err) {
                    winston.error(err)
                  }
                })
              })
            }
          }
        })
      })
    },
    getCHA(id, callback) {
      let query = {}
      if(id) {
        query = {id}
      }
      const mongoose = require('mongoose')
      mongoose.connect(uri, {}, () => {
        models.CHAModel.find(query, (err, data) => {
          if (err) {
            return callback(err);
          }
          return callback(false, data)
        });
      })
    },
    getHFS(facilityId, callback) {
      let query = {}
      if(facilityId) {
        query = {facility: facilityId}
      }
      const mongoose = require('mongoose')
      mongoose.connect(uri, {}, () => {
        models.HFSModel.find(query, (err, data) => {
          if (err) {
            return callback(err);
          }
          return callback(false, data)
        });
      })
    },
    getCHAByUsername(username, callback) {
      let query = {
        odkUsername: username
      }
      const mongoose = require('mongoose')
      mongoose.connect(uri, {}, () => {
        models.CHAModel.find(query, (err, data) => {
          if (err) {
            return callback(err);
          }
          return callback(false, data)
        });
      })
    },
    getCHAByVillage(villageId, callback) {
      let query = {
        village: villageId
      }
      const mongoose = require('mongoose')
      mongoose.connect(uri, {}, () => {
        models.CHAModel.find(query, (err, data) => {
          if (err) {
            return callback(err);
          }
          return callback(false, data)
        });
      })
    },
    getFacilityFromVillage(villageId, callback) {
      let query = {
        _id: villageId
      }
      const mongoose = require('mongoose')
      mongoose.connect(uri, {}, () => {
        models.VillagesModel.find(query, (err, data) => {
          if (err) {
            return callback(err);
          }
          return callback(false, data)
        });
      })
    }
  }
}

function getFormField(field, extractedFields, callback) {
  if(field.type == 'note') {
    return callback()
  }
  if(field.type == 'group' || field.type == 'repeat') {
    let obj
    if(field.type == 'group') {
      obj = extractedFields
    } else {
      if(Array.isArray(extractedFields)) {
        extractedFields[0][field.name] = []
        obj = extractedFields[0][field.name]
      } else {
        extractedFields[field.name] = []
        obj = extractedFields[field.name]
      }
    }
    async.each(field.children, (child, nxtChild) => {
      getFormField(child, obj, () => {
        return nxtChild()
      })
    }, () => {
      return callback()
    })
  } else {
    let type
    if(field.type == 'integer') {
      type = 'Number'
    } else if(field.type == 'date' || field.type == 'start' || field.type == 'end' || field.type == 'today') {
      type = 'Date'
    } else {
      type = 'String'
    }
    if(Array.isArray(extractedFields)) {
      if(extractedFields.length == 0) {
        extractedFields[0] = {}
      }
      extractedFields[0][field.name] = {
        type: type
      }
    } else {
      extractedFields[field.name] = {
        type: type
      }
    }
    return callback()
  }
}
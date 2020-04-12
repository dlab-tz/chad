require('./init');
require('./connection');
const moment = require('moment');
const mongoose = require('mongoose');
const deepmerge = require('deepmerge');
const winston = require('winston');
const async = require('async');
const URI = require('urijs');
const request = require('request');
const models = require('./models');
const config = require('./config');
const database = config.getConf('DB_NAME');
const mongoUser = config.getConf('DB_USER');
const mongoPasswd = config.getConf('DB_PASSWORD');
const mongoHost = config.getConf('DB_HOST');
const mongoPort = config.getConf('DB_PORT');

let mongoURI;
if (mongoUser && mongoPasswd) {
  mongoURI = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
} else {
  mongoURI = `mongodb://${mongoHost}:${mongoPort}/${database}`;
}

module.exports = function(rpFnc) {
  const rapidpro = rpFnc;
  return {
    getRegions(id, callback) {
      let filter = {};
      if (id) {
        filter = {
          _id: id,
        };
      }
      models.RegionsModel.find(filter)
        .lean()
        .exec({}, (err, data) => {
          if (err) {
            winston.error(err);
            return callback('Unexpected error occured,please retry');
          }
          callback(err, data);
        });
    },
    getDistricts(id, callback) {
      let filter = {};
      if (id) {
        filter = {
          _id: id,
        };
      }
      models.DistrictsModel.find(filter)
        .populate('parent')
        .lean()
        .exec({}, (err, data) => {
          if (err) {
            winston.error(err);
            return callback('Unexpected error occured,please retry');
          }
          callback(err, data);
        });
    },
    getWards(id, callback) {
      let filter = {};
      if (id) {
        filter = {
          _id: id,
        };
      }
      models.WardsModel.find(filter)
        .populate('parent')
        .lean()
        .exec({}, (err, data) => {
          if (err) {
            winston.error(err);
            return callback('Unexpected error occured,please retry');
          }
          callback(err, data);
        });
    },
    getVillages(id, callback) {
      let filter = {};
      if (id) {
        filter = {
          _id: id,
        };
      }
      models.VillagesModel.find(filter)
        .populate('parent')
        .lean()
        .exec({}, (err, data) => {
          if (err) {
            winston.error(err);
            return callback('Unexpected error occured,please retry');
          }
          callback(err, data);
        });
    },
    getFacilities(id, callback) {
      let filter = {};
      if (id) {
        filter = {
          _id: id,
        };
      }
      models.FacilitiesModel.find(filter)
        .populate('parent')
        .lean()
        .exec({}, (err, data) => {
          if (err) {
            winston.error(err);
            return callback('Unexpected error occured,please retry');
          }
          callback(err, data);
        });
    },
    updateRegion(id, name, callback) {
      models.RegionsModel.findByIdAndUpdate(
        id,
        {
          name: name,
        },
        (err, data) => {
          if (err) {
            return callback(err);
          }
          return callback(false, data);
        }
      );
    },
    editLocation(id, name, type, parent, callback) {
      let updateQuery = {
        name: name,
      };
      if (parent) {
        updateQuery.parent = parent;
      }
      let model = type + 'Model';
      models[model].findByIdAndUpdate(id, updateQuery, (err, data) => {
        if (err) {
          return callback(err);
        }
        return callback(false, data);
      });
    },
    resetPassword(id, password, callback) {
      models.UsersModel.findByIdAndUpdate(
        id,
        {
          password: password,
        },
        (err, data) => {
          if (err) {
            return callback(err);
          }
          return callback(false, data);
        }
      );
    },
    updateCHARapidproId(chadid, uuid, callback) {
      models.CHAModel.findByIdAndUpdate(
        chadid,
        {
          rapidproId: uuid,
        },
        (err, data) => {
          if (err) {
            return callback(err);
          }
          return callback(false, data);
        }
      );
    },
    updateHFSRapidproId(chadid, uuid, callback) {
      models.HFSModel.findByIdAndUpdate(
        chadid,
        {
          rapidproId: uuid,
        },
        (err, data) => {
          if (err) {
            return callback(err);
          }
          return callback(false, data);
        }
      );
    },
    getSubmissions(startDate, endDate, formID, model, callback) {
      let filter = {};
      if (startDate || endDate) {
        filter.today = {
          $gte: startDate,
          $lte: endDate,
        };
      }
      this.generateSubmissionSchema(formID, (schemaFields) => {
        let submissionSchema = new mongoose.Schema(schemaFields);
        let connection = mongoose.createConnection(mongoURI, {
          useNewUrlParser: true,
        });
        connection.on('error', () => {
          winston.error(`An error occured while connecting to DB ${database}`);
        });
        connection.once('open', () => {
          const SubmissionModel = connection.model(model, submissionSchema);
          SubmissionModel.find(filter)
            .lean()
            .exec({}, (err, data) => {
              if (err) {
                winston.error(err);
                return callback([]);
              }
              return callback(false, JSON.parse(JSON.stringify(data)));
            });
        });
      });
    },
    generateSubmissionSchema(formID, callback) {
      let schemaFields = {};
      this.downloadJSONForm(formID, (err, response, householdForm) => {
        householdForm = JSON.parse(householdForm);
        async.each(householdForm.children, (field, nxtField) => {
          getFormField(field, schemaFields, () => {
            return nxtField();
          });
        }, () => {
          this.addOtherSchemaFields(schemaFields, () => {
            return callback(schemaFields);
          });
        });
      });
    },
    addOtherSchemaFields(schemaFields, callback) {
      //add geolocation
      schemaFields['_geolocation'] = {
        type: [],
      };
      schemaFields.submissionID = {
        type: 'String',
      };
      // add referal ID
      if (
        schemaFields.rp_preg_woman &&
        Array.isArray(schemaFields.rp_preg_woman)
      ) {
        schemaFields.rp_preg_woman[0].referalID = {};
        schemaFields.rp_preg_woman[0].referalID.type = 'String';
        schemaFields.rp_preg_woman[0].referalStatus = {};
        schemaFields.rp_preg_woman[0].referalStatus.type = 'String';
      }
      if (
        schemaFields.rp_breast_feed_mother &&
        Array.isArray(schemaFields.rp_breast_feed_mother)
      ) {
        schemaFields.rp_breast_feed_mother[0].referalID = {};
        schemaFields.rp_breast_feed_mother[0].referalID.type = 'String';
        schemaFields.rp_breast_feed_mother[0].referalStatus = {};
        schemaFields.rp_breast_feed_mother[0].referalStatus.type = 'String';

        if (
          schemaFields.rp_breast_feed_mother.rp_neonatal_baby &&
          Array.isArray(schemaFields.rp_breast_feed_mother.rp_neonatal_baby)
        ) {
          schemaFields.rp_breast_feed_mother[0].rp_neonatal_baby[0].referalID = {};
          schemaFields.rp_breast_feed_mother[0].rp_neonatal_baby[0].referalID.type =
            'String';
          schemaFields.rp_breast_feed_mother[0].rp_neonatal_baby[0].referalStatus = {};
          schemaFields.rp_breast_feed_mother[0].rp_neonatal_baby[0].referalStatus.type =
            'String';
        }
      }
      if (
        schemaFields.rp_children_under_5 &&
        Array.isArray(schemaFields.rp_children_under_5)
      ) {
        schemaFields.rp_children_under_5[0].referalID = {};
        schemaFields.rp_children_under_5[0].referalID.type = 'String';
        schemaFields.rp_children_under_5[0].referalStatus = {};
        schemaFields.rp_children_under_5[0].referalStatus.type = 'String';
      }
      if (
        schemaFields.rp_sick_person &&
        Array.isArray(schemaFields.rp_sick_person)
      ) {
        schemaFields.rp_sick_person[0].referalID = {};
        schemaFields.rp_sick_person[0].referalID.type = 'String';
        schemaFields.rp_sick_person[0].referalStatus = {};
        schemaFields.rp_sick_person[0].referalStatus.type = 'String';
      }
      schemaFields.referalID = {};
      schemaFields.referalID.type = 'String';
      schemaFields.referalStatus = {};
      schemaFields.referalStatus.type = 'String';
      return callback();
    },
    saveSubmission(submission, formID, model, callback) {
      let saveSubmission = {};
      this.generateSubmissionSchema(formID, (schemaFields) => {
        cleanKeys(submission, saveSubmission, () => {
          async.eachOf(saveSubmission, (submittedData, key, nxtData) => {
            if (!schemaFields.hasOwnProperty(key)) {
              delete saveSubmission[key];
            }
            return nxtData();
          }, () => {
            let submissionSchema = new mongoose.Schema(schemaFields);
            let connection = mongoose.createConnection(mongoURI, {
              useNewUrlParser: true,
            });
            connection.on('error', () => {
              winston.error(
                `An error occured while connecting to DB ${database}`
              );
            });
            connection.once('open', () => {
              const SubmissionModel = connection.model(model, submissionSchema);
              let newSubmission = new SubmissionModel(saveSubmission);
              newSubmission.save((err, data) => {
                connection.close();
                if (err) {
                  winston.error(err);
                }
                return callback(err)
              });
            });
          });
        });
      });

      function cleanKeys(data, saveSubmission, callback) {
        if (Array.isArray(data)) {
          async.eachOf(
            data,
            (dt, key, nxtDt) => {
              if (typeof dt !== 'object') {
                saveSubmission.push(dt);
                return nxtDt();
              }
              saveSubmission[key] = {};
              cleanKeys(dt, saveSubmission[key], () => {
                return nxtDt();
              });
            },
            () => {
              return callback();
            }
          );
        } else {
          async.eachOf(
            data,
            (dt, key, nxtDt) => {
              if (Array.isArray(dt)) {
                let key1 = key.split('/').pop();
                saveSubmission[key1] = [];
                data[key1] = deepmerge.all([data[key]]);
                cleanKeys(data[key1], saveSubmission[key1], () => {
                  return nxtDt();
                });
              } else {
                key = key.split('/').pop();
                saveSubmission[key] = dt;
                return nxtDt();
              }
            },
            () => {
              return callback();
            }
          );
        }
      }
    },
    addReferals(referal, callback) {
      if (mongoUser && mongoPasswd) {
        var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
      } else {
        var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
      }
      let Referal = new models.ReferalsModel({
        ...referal
      });
      Referal.save((err, data) => {
        if (err) {
          winston.error(err);
          res.status(500).json({
            error: 'Internal error occured while saving referals',
          });
        } else {
          winston.info('Referal saved successfully');
        }
        return callback(err);
      });
    },
    updateReferal(referalID, referalStatus, HFSphone, formID, callback) {
      this.generateSubmissionSchema(formID, schemaFields => {
        let submissionSchema = new mongoose.Schema(schemaFields);
        let connection = mongoose.createConnection(mongoURI, {
          useNewUrlParser: true,
        });
        connection.on('error', () => {
          winston.error(`An error occured while connecting to DB ${database}`);
        });
        let referalFound = false;
        connection.once('open', () => {
          const SubmissionModel = connection.model(
            'Submissions',
            submissionSchema
          );
          let submissions = SubmissionModel.find().cursor();
          submissions.on('data', submission => {
            submission = JSON.parse(JSON.stringify(submission));
            if (submission.referalID && submission.referalID == referalID) {
              let sms = `HFS with phone ${HFSphone} updated Referal of ID ${referalID} to ${referalStatus}`;
              rapidpro.alertCHA(submission.username, sms);
              submission.referalStatus = referalStatus;
              referalFound = true;
              SubmissionModel.findByIdAndUpdate(
                submission._id,
                submission,
                (err, data) => {
                  return;
                }
              );
            } else {
              async.eachOf(submission, (subm, index, nxtSubm) => {
                if (Array.isArray(subm)) {
                  searchReferal(
                    submission[index],
                    referalID,
                    referalStatus,
                    found => {
                      if (found) {
                        let sms = `HFS with phone ${HFSphone} updated Referal of ID ${referalID} to ${referalStatus}`;
                        rapidpro.alertCHA(submission.username, sms);
                        referalFound = true;
                        SubmissionModel.findByIdAndUpdate(
                          submission._id,
                          submission,
                          (err, data) => {
                            return;
                          }
                        );
                      }
                    }
                  );
                }
              });
            }
          });
          submissions.on('close', () => {
            if (!referalFound) {
              let sms = `Referal with ID ${referalID} was not found on the system, please cross check referal ID and resend`;
              let phone = ['tel:' + HFSphone];
              rapidpro.broadcast({
                tels: phone,
                sms,
              });
            } else {
              let sms = `Referal with ID ${referalID} updated successfully`;
              let phone = ['tel:' + HFSphone];
              rapidpro.broadcast({
                tels: phone,
                sms,
              });
            }
            return callback();
          });
        });
      });

      function searchReferal(submission, referalID, referalStatus, callback) {
        let found = false;
        async.eachOf(
          submission,
          (subm, index, nxtSubm) => {
            if (subm == referalID) {
              submission.referalStatus = referalStatus;
              found = true;
              return callback(found);
            }
            if (typeof subm === 'object' || Array.isArray(subm)) {
              searchReferal(
                submission[index],
                referalID,
                referalStatus,
                fnd => {
                  found = fnd;
                  if (found) {
                    return callback(found);
                  }
                  return nxtSubm();
                }
              );
            } else {
              return nxtSubm();
            }
          },
          () => {
            return callback(found);
          }
        );
      }
    },

    addPregnantWoman(
      house,
      fullName,
      age,
      last_clin_vis,
      last_menstrual,
      cha_username
    ) {
      if (mongoUser && mongoPasswd) {
        var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
      } else {
        var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
      }
      this.getCHAByUsername(cha_username, (err, cha) => {
        if (err) {
          winston.error(err);
          return;
        }
        if (cha.length == 0) {
          return;
        }
        let villageId = cha[0].village;
        let expected_delivery = '';
        if (last_menstrual) {
          expected_delivery = moment(last_menstrual)
            .add(7, 'days')
            .add(9, 'M')
            .format('YYYY-MM-DD');
        }
        let nxt_clinic_alert = '';
        if (last_clin_vis) {
          nxt_clinic_alert = moment(last_clin_vis)
            .add(1, 'M')
            .subtract('2', 'days')
            .format('YYYY-MM-DD');
        }
        let PregnantWoman = new models.PregnantWomenModel({
          house: house,
          village: villageId,
          fullName: fullName,
          age: age,
          nxtClinicAlert: nxt_clinic_alert,
          expectedDeliveryDate: expected_delivery,
        });
        PregnantWoman.save((err, data) => {
          if (err) {
            winston.error(err);
            res.status(500).json({
              error: 'Internal error occured',
            });
          } else {
            winston.info('Pregnant Woman saved successfully');
            return;
          }
        });
      });
    },
    updatePregnantWoman(
      house,
      fullName,
      age,
      last_clin_vis,
      last_menstrual,
      cha_username
    ) {
      this.getCHAByUsername(cha_username, (err, cha) => {
        if (err) {
          winston.error(err);
          return;
        }
        if (cha.length == 0) {
          return;
        }
        let villageId = cha[0].village;
        models.PregnantWomenModel.find(
          {
            village: villageId,
            house: house,
            fullName: fullName,
            age: age,
          },
          (err, data) => {
            try {
              data = JSON.parse(JSON.stringify(data));
            } catch (error) {
              winston.error(error);
            }
            if (data.length > 0) {
              let exist_last_clin_vis = data[0].last_clin_vis;
              let exist_last_menstrual = data[0].last_menstrual;
              let updateQuery = {};
              if (!exist_last_clin_vis && last_clin_vis) {
                let nxt_clinic_alert = moment(last_clin_vis)
                  .add(1, 'M')
                  .subtract('2', 'days')
                  .format('YYYY-MM-DD');
                updateQuery.nxtClinicAlert = nxt_clinic_alert;
              }
              if (!exist_last_menstrual && last_menstrual) {
                let expected_delivery = moment(last_menstrual)
                  .add(7, 'days')
                  .add(9, 'M')
                  .format('YYYY-MM-DD');
                updateQuery.expectedDeliveryDate = expected_delivery;
              }
              if (Object.keys(updateQuery).length > 0) {
                models.PregnantWomenModel.findByIdAndUpdate(
                  data[0]._id,
                  updateQuery,
                  (err, data) => {
                    if (err) {
                      winston.error(err);
                    }
                  }
                );
              }
            }
          }
        );
      });
    },
    getCHA(id, callback) {
      let query = {};
      if (id) {
        query = {
          id,
        };
      }
      models.CHAModel.find(query)
        .populate('village')
        .lean()
        .exec({}, (err, data) => {
          if (err) {
            winston.error(err);
            return callback('Unexpected error occured,please retry');
          }
          callback(err, data);
        });
    },
    getHFS(facilityId, callback) {
      let query = {};
      if (facilityId) {
        query = {
          facility: facilityId,
        };
      }
      models.HFSModel.find(query)
        .populate('facility')
        .lean()
        .exec({}, (err, data) => {
          if (err) {
            winston.error(err);
            return callback('Unexpected error occured,please retry');
          }
          callback(err, data);
        });
    },
    getCHAByUsername(username, callback) {
      let query = {
        odkUsername: username,
      };
      models.CHAModel.find(query)
      .populate('village')
      .lean()
      .exec({}, (err, data) => {
        if (err) {
          return callback(err);
        }
        return callback(false, data);
      });
    },
    getCHAByVillage(villageId, callback) {
      let query = {
        village: villageId,
      };
      models.CHAModel.find(query, (err, data) => {
        if (err) {
          return callback(err);
        }
        return callback(false, data);
      });
    },
    getFacilityFromVillage(villageId, callback) {
      let query = {
        parent: villageId,
      };
      models.FacilitiesModel.find(query, (err, data) => {
        if (err) {
          return callback(err);
        }
        return callback(false, data);
      });
    },
    downloadJSONForm(formId, callback) {
      formId = formId.toString()
      winston.info('Getting online XLSForm in JSON format');
      let token = config.getConf('aggregator:token');
      let host = config.getConf('aggregator:host');
      let url = new URI(host)
        .segment('/api/v1/forms')
        .segment(formId)
        .segment('form.json')
        .toString();
      let options = {
        url: url,
        headers: {
          Authorization: `Token ${token}`
        },
      };
      request.get(options, (err, res, body) => {
        winston.info('Finished downloading XLSForm in JSON Format');
        if (err) {
          winston.error(err, res, body);
        }
        return callback(err, res, body);
      });
    },
  };
};

function getFormField(field, extractedFields, callback) {
  if (field.type == 'note') {
    return callback();
  }
  if (field.type == 'group' || field.type == 'repeat') {
    let obj;
    if (field.type == 'group') {
      obj = extractedFields;
    } else {
      if (Array.isArray(extractedFields)) {
        extractedFields[0][field.name] = [];
        obj = extractedFields[0][field.name];
      } else {
        extractedFields[field.name] = [];
        obj = extractedFields[field.name];
      }
    }
    async.each(
      field.children,
      (child, nxtChild) => {
        getFormField(child, obj, () => {
          return nxtChild();
        });
      },
      () => {
        return callback();
      }
    );
  } else {
    let type;
    if (field.type == 'integer') {
      type = 'Number';
    } else if (
      field.type == 'date' ||
      field.type == 'start' ||
      field.type == 'end' ||
      field.type == 'today'
    ) {
      type = 'Date';
    } else {
      type = 'String';
    }
    if (Array.isArray(extractedFields)) {
      if (extractedFields.length == 0) {
        extractedFields[0] = {};
      }
      extractedFields[0][field.name] = {
        type: type,
      };
    } else {
      extractedFields[field.name] = {
        type: type,
      };
    }
    return callback();
  }
}

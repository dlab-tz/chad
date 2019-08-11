require('./init')
require('./clone')
require('./connection')
const express = require('express')
const winston = require('winston')
const async = require('async')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors');
const bodyParser = require('body-parser')
const shortid = require('shortid');
const uuid4 = require('uuid/v4');
const fs = require('fs')
var guiRouter = require('./routes/gui')
const aggregator = require('./aggregator')
const mixin = require('./mixin')
const rapidpro = require('./rapidpro')
const config = require('./config')
const models = require('./models')
const mongo = require('./mongo')(rapidpro)
const port = config.getConf('server:port')

const app = express()

let jwtValidator = function (req, res, next) {
  if (req.method == "OPTIONS" ||
    req.path == "/authenticate/" ||
    req.path == "/syncLocations" ||
    req.path == "/newSubmission" ||
    req.path == "/clinicReminder" ||
    req.path == "/updateReferalStatus" ||
    req.path == "/" ||
    req.path.startsWith("/static/js") ||
    req.path.startsWith("/static/css") ||
    req.path.startsWith("/static/img")
  ) {
    return next()
  }
  if (!req.headers.authorization || req.headers.authorization.split(' ').length !== 2) {
    winston.error("Token is missing")
    res.set('Access-Control-Allow-Origin', '*')
    res.set('WWW-Authenticate', 'Bearer realm="Token is required"')
    res.set('charset', 'utf - 8')
    res.status(401).json({
      error: 'Token is missing'
    })
  } else {
    tokenArray = req.headers.authorization.split(' ')
    let token = req.headers.authorization = tokenArray[1]
    jwt.verify(token, config.getConf('auth:secret'), (err, decoded) => {
      if (err) {
        winston.warn("Token expired")
        res.set('Access-Control-Allow-Origin', '*')
        res.set('WWW-Authenticate', 'Bearer realm="Token expired"')
        res.set('charset', 'utf - 8')
        res.status(401).json({
          error: 'Token expired'
        })
      } else {
        // winston.info("token is valid")
        if (req.path == "/isTokenActive/") {
          res.set('Access-Control-Allow-Origin', '*')
          res.status(200).send(true)
        } else {
          return next()
        }
      }
    })
  }
}
app.use(jwtValidator)
app.use(express.static(__dirname + '/../gui'));
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(bodyParser.urlencoded({
  extended: true,
}));
app.use(bodyParser.json());
app.use('/', guiRouter)

app.post('/newSubmission', (req, res) => {
  //acknowlodge recipient
  res.status(200).send()
  winston.info('New submission received')
  let householdFormID = config.getConf("aggregator:householdForm:id")
  let householdFormName = uuid4()
  let submission = req.body
  // populate any new house/ pregnant woman as a choice
  aggregator.downloadXLSForm(householdFormID, householdFormName, (err) => {
    mixin.getWorkbook(__dirname + '/' + householdFormName + '.xlsx', (chadWorkbook) => {
      let chadChoicesWorksheet = chadWorkbook.getWorksheet('choices')
      let [house_name] = mixin.getDataFromJSON(submission, 'house_name')
      async.series({
        new_house: (callback) => {
          if (house_name == 'add_new') {
            let [new_house_name] = mixin.getDataFromJSON(submission, 'house_name_new')
            let [new_house_number] = mixin.getDataFromJSON(submission, 'house_number_new')
            let [village] = mixin.getDataFromJSON(submission, 'village')
            aggregator.populateHouses(chadChoicesWorksheet, new_house_name, new_house_number, village, (err) => {
              winston.info('writting new house into local household_visit XLSForm')
              chadWorkbook.xlsx.writeFile(__dirname + '/' + householdFormName + '.xlsx').then(() => {
                return callback(false, false)
              })
            })
          } else {
            return callback(false, false)
          }
        },
        new_preg_wom: (callback) => {
          async.each(submission.rp_preg_woman, (preg_wom, nxtPregWom) => {
            let [pregnant_woman_name] = mixin.getDataFromJSON(preg_wom, 'pregnant_woman_name')
            if (pregnant_woman_name == 'add_new') {
              let [new_preg_woman_name] = mixin.getDataFromJSON(preg_wom, 'pregnant_woman_name_new')
              let [new_pregnant_woman_age] = mixin.getDataFromJSON(preg_wom, 'pregnant_woman_age_new')
              let [house_number] = mixin.getDataFromJSON(submission, 'house_number_new')
              if (!house_number) {
                [house_number] = mixin.getDataFromJSON(submission, 'house_number')
              }
              aggregator.populatePregnantWomen(chadChoicesWorksheet, new_preg_woman_name, new_pregnant_woman_age, house_number, (err) => {
                winston.info('writting new pregnant woman into local household_visit XLSForm')
                chadWorkbook.xlsx.writeFile(__dirname + '/' + householdFormName + '.xlsx').then(() => {
                  return nxtPregWom()
                })
              })
            } else {
              return nxtPregWom()
            }
          }, () => {
            return callback(false, false)
          })
        }
      }, () => {
        winston.info('Updating the online CHAD XLSForm with the local household XLSForm')
        aggregator.publishForm(householdFormID, householdFormName, () => {
          fs.unlink(__dirname + '/' + householdFormName + '.xlsx', () => {

          })
          winston.info('Online household XLSForm Updated')
        })
      })

      let submissionKeys = Object.keys(submission)
      let submissionTopLevelKeys = submissionKeys.map((key) => {
        return key.split('/').pop()
      })

      let [danger_signs_emergency] = mixin.getDataFromJSON(submission, 'danger_signs_emergency')
      // check emergency visit referal
      if (danger_signs_emergency) {
        let referalID = shortid.generate()
        submission.referalID = referalID
        submission.referalStatus = 'pending'
        let sms = `ID: ${referalID} \\n Issues:`
        let issues = ''
        danger_signs_emergency = danger_signs_emergency.split(" ")
        async.eachSeries(danger_signs_emergency, (danger_sign, nxtDangerSign) => {
          if (danger_sign === 'others') {
            if (issues) {
              issues += ", "
            }
            let [em_issues] = mixin.getDataFromJSON(submission, 'danger_signs_emergency_others')
            issues += em_issues
            return nxtDangerSign()
          }
          const promises = []
          chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
            promises.push(new Promise((resolve, reject) => {
              if (chadRows.values.includes('danger_signs_emergency') && chadRows.values.includes(danger_sign)) {
                if (issues) {
                  issues += ", "
                }
                issues += chadRows.values[chadRows.values.length - 1]
                resolve()
              } else {
                resolve()
              }
            }))
          })
          Promise.all(promises).then(() => {
            return nxtDangerSign()
          })
        }, () => {
          sms += issues
          rapidpro.alertReferal(submission.username, sms)
        })
      }

      // check if needs referal
      // check pregnant woman referral
      let [rp_preg_woman, rp_preg_woman_full_key] = mixin.getDataFromJSON(submission, 'rp_preg_woman')
      if (Array.isArray(rp_preg_woman) && rp_preg_woman.length > 0) {
        async.eachOf(rp_preg_woman, (preg_wom, preg_wom_ind, nxtPregWom) => {
          // Schedule a reminder for clinic
          let [house_number] = mixin.getDataFromJSON(submission, 'house_name')
          if (house_number == 'add_new') {
            [house_number] = mixin.getDataFromJSON(submission, 'house_number_new')
          }
          [last_clin_vis] = mixin.getDataFromJSON(preg_wom, 'forth_visit_above')
          if (!last_clin_vis) {
            [last_clin_vis] = mixin.getDataFromJSON(preg_wom, 'third_visit')
            if (!last_clin_vis) {
              [last_clin_vis] = mixin.getDataFromJSON(preg_wom, 'second_visit')
              if (!last_clin_vis) {
                [last_clin_vis] = mixin.getDataFromJSON(preg_wom, 'first_visit')
              }
            }
          }
          let [last_menstrual] = mixin.getDataFromJSON(preg_wom, 'last_menstrual_period')
          let [preg_wom_name] = mixin.getDataFromJSON(preg_wom, 'pregnant_woman_name')
          let preg_wom_age
          if (preg_wom_name === 'add_new') {
            [preg_wom_name] = mixin.getDataFromJSON(preg_wom, 'pregnant_woman_name_new')
            let preg_wom_age_dt = mixin.getDataFromJSON(preg_wom, 'pregnant_woman_age_new')
            preg_wom_age = preg_wom_age_dt[0]
            mongo.addPregnantWoman(house_number, preg_wom_name, preg_wom_age, last_clin_vis, last_menstrual, submission.username)
          } else if (preg_wom_name !== 'add_new') {
            let preg_wom_name_arr = preg_wom_name.split('-')
            preg_wom_name = preg_wom_name_arr.shift().trim()
            preg_wom_age = preg_wom_name_arr.shift().trim()
            mongo.updatePregnantWoman(house_number, preg_wom_name, preg_wom_age, last_clin_vis, last_menstrual, submission.username)
          }
          // end of scheduling a reminder for clinic

          let [danger_signs] = mixin.getDataFromJSON(preg_wom, 'danger_signs')
          if (danger_signs) {
            let referalID = shortid.generate()
            submission[rp_preg_woman_full_key][preg_wom_ind].referalID = referalID
            submission[rp_preg_woman_full_key][preg_wom_ind].referalStatus = 'pending'
            let sms = `ID: ${referalID} \\n Patient: ${preg_wom_name}, Age: ${preg_wom_age} \\n
            Pregnant Woman \\n Issues: `
            let issues = ''
            danger_signs = danger_signs.split(" ")
            async.eachSeries(danger_signs, (danger_sign, nxtDangerSign) => {
              const promises = []
              chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
                promises.push(new Promise((resolve, reject) => {
                  if (chadRows.values.includes('danger_signs') && chadRows.values.includes(danger_sign)) {
                    if (issues) {
                      issues += ", "
                    }
                    issues += chadRows.values[chadRows.values.length - 1]
                    resolve()
                  } else {
                    resolve()
                  }
                }))
              })
              Promise.all(promises).then(() => {
                return nxtDangerSign()
              })
            }, () => {
              sms += issues
              rapidpro.alertReferal(submission.username, sms)
              return nxtPregWom()
            })
          } else {
            return nxtPregWom()
          }
        })
      }

      // check postnatal mother referral
      let [rp_breast_feed_mother, rp_breast_feed_mother_full_key] = mixin.getDataFromJSON(submission, 'rp_breast_feed_mother')
      if (Array.isArray(rp_breast_feed_mother) && rp_breast_feed_mother.length > 0) {
        async.eachOf(rp_breast_feed_mother, (postnatal_mthr, postnatal_mthr_ind, nxtPostnatalMthr) => {
          let [psigns] = mixin.getDataFromJSON(postnatal_mthr, 'puperium_danger_signs')
          let signs = []
          if (psigns) {
            signs = psigns.split(" ")
          }
          if (signs.length > 0) {
            let referalID = shortid.generate()
            submission[rp_breast_feed_mother_full_key][postnatal_mthr_ind].referalID = referalID
            submission[rp_breast_feed_mother_full_key][postnatal_mthr_ind].referalStatus = 'pending'
            let sms = `ID: ${referalID} \\n Patient:Postnatal mother \\n Issues:`
            let issues = ''
            async.eachSeries(signs, (sign, nxtDangerSign) => {
              const promises = []
              chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
                promises.push(new Promise((resolve, reject) => {
                  if (chadRows.values.includes('puperium_danger_signs') && chadRows.values.includes(sign)) {
                    if (issues) {
                      issues += ", "
                    }
                    issues += chadRows.values[chadRows.values.length - 1]
                    resolve()
                  } else {
                    resolve()
                  }
                }))
              })
              Promise.all(promises).then(() => {
                return nxtDangerSign()
              })
            }, () => {
              sms += issues
              rapidpro.alertReferal(submission.username, sms)
              return nxtPostnatalMthr()
            })
          } else {
            return nxtPostnatalMthr()
          }
        })
      }

      // check neonatal child referral
      if (Array.isArray(rp_breast_feed_mother) && rp_breast_feed_mother.length > 0) {
        async.eachOf(rp_breast_feed_mother, (postnatal_mthr, postnatal_mthr_ind, nxtNeonatalChild) => {
          let [neo_babies, neo_babies_full_key] = mixin.getDataFromJSON(postnatal_mthr, 'rp_neonatal_baby')
          async.eachOf(neo_babies, (neo_baby, neo_baby_ind, nxtNeoBaby) => {
            let [nsigns] = mixin.getDataFromJSON(neo_baby, 'neonatal_danger_sign')
            let signs = []
            if (nsigns) {
              signs = nsigns.split(" ")
            }

            if (signs.length > 0) {
              let referalID = shortid.generate()
              submission[rp_breast_feed_mother_full_key][postnatal_mthr_ind][neo_babies_full_key][neo_baby_ind].referalID = referalID
              submission[rp_breast_feed_mother_full_key][postnatal_mthr_ind][neo_babies_full_key][neo_baby_ind].referalStatus = 'pending'
              let sms = `ID: ${referalID} \\n Patient:Neonatal baby \\n Issues:`
              let issues = ''
              async.eachSeries(signs, (sign, nxtDangerSign) => {
                const promises = []
                chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
                  promises.push(new Promise((resolve, reject) => {
                    if (chadRows.values.includes('neonatal_danger_sign') && chadRows.values.includes(sign)) {
                      if (issues) {
                        issues += ", "
                      }
                      issues += chadRows.values[chadRows.values.length - 1]
                      resolve()
                    } else {
                      resolve()
                    }
                  }))
                })
                Promise.all(promises).then(() => {
                  return nxtDangerSign()
                })
              }, () => {
                sms += issues
                rapidpro.alertReferal(submission.username, sms)
                return nxtNeoBaby()
              })
            } else {
              return nxtNeoBaby()
            }
          }, () => {
            return nxtNeonatalChild()
          })
        })
      }

      // check children under 5 referral
      let [under_5, under_5_full_key] = mixin.getDataFromJSON(submission, 'rp_children_under_5')
      if (under_5 && under_5.length > 0) {
        async.eachOf(under_5, (susp_pat, susp_pat_ind, nxtSuspPat) => {
          let [danger_signs] = mixin.getDataFromJSON(susp_pat, 'danger_signs_child')
          if (danger_signs) {
            let referalID = shortid.generate()
            submission[under_5_full_key][susp_pat_ind].referalID = referalID
            submission[under_5_full_key][susp_pat_ind].referalStatus = 'pending'
            let [age] = mixin.getDataFromJSON(susp_pat, 'child_age')
            let sms = `ID: ${referalID} \\n `
            if (age) {
              sms += `Age: ${age} \\n`
            }
            sms += `Patient: Children under 5 \\n Issues: `
            let issues = ''
            danger_signs = danger_signs.split(" ")
            async.eachSeries(danger_signs, (danger_sign, nxtDangerSign) => {
              const promises = []
              chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
                promises.push(new Promise((resolve, reject) => {
                  if (chadRows.values.includes('danger_signs_child') && chadRows.values.includes(danger_sign)) {
                    if (issues) {
                      issues += ", "
                    }
                    issues += chadRows.values[chadRows.values.length - 1]
                    resolve()
                  } else {
                    resolve()
                  }
                }))
              })
              Promise.all(promises).then(() => {
                return nxtDangerSign()
              })
            }, () => {
              sms += issues
              rapidpro.alertReferal(submission.username, sms)
              return nxtSuspPat()
            })
          } else {
            return nxtSuspPat()
          }
        })
      }

      // check  any other sick person referral
      let [sick_person, sick_person_full_key] = mixin.getDataFromJSON(submission, 'rp_sick_person')
      if (sick_person && sick_person.length > 0) {
        async.eachOf(sick_person, (susp_pat, susp_pat_ind, nxtSuspPat) => {
          let danger_signs = mixin.getDataFromJSON(susp_pat, 'general_examination')
          let [age] = mixin.getDataFromJSON(susp_pat, 'sick_person_age')
          if (danger_signs) {
            let referalID = shortid.generate()
            submission[sick_person_full_key][susp_pat_ind].referalID = referalID
            submission[sick_person_full_key][susp_pat_ind].referalStatus = 'pending'
            let sms = `ID: ${referalID} \\n `
            if (age) {
              sms += `Age: ${age} \\n`
            }
            sms += "Patient:Sick person \\n Issues:"
            let issues = ''
            danger_signs = danger_signs.split(" ")
            async.eachSeries(danger_signs, (danger_sign, nxtDangerSign) => {
              if (danger_sign === 'others') {
                if (issues) {
                  issues += ", "
                }
                let [susp_issues] = mixin.getDataFromJSON(susp_pat, 'general_examination_others')
                issues += susp_issues
                return nxtDangerSign()
              }
              const promises = []
              chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
                promises.push(new Promise((resolve, reject) => {
                  if (chadRows.values.includes('general_examination') && chadRows.values.includes(danger_sign)) {
                    if (issues) {
                      issues += ", "
                    }
                    issues += chadRows.values[chadRows.values.length - 1]
                    resolve()
                  } else {
                    resolve()
                  }
                }))
              })
              Promise.all(promises).then(() => {
                return nxtDangerSign()
              })
            }, () => {
              sms += issues
              rapidpro.alertReferal(submission.username, sms)
              return nxtSuspPat()
            })
          } else {
            return nxtSuspPat()
          }
        })
      }
      mongo.saveSubmission(submission)
    })
  })
})

app.get('/updateReferalStatus', (req, res) => {
  let referal = req.query.referal_update
  let status = req.query.status
  let HFSphone = req.query.phone.toString()
  if (HFSphone[0] != '+') {
    HFSphone = '+' + HFSphone.toString()
    HFSphone = HFSphone.replace(/\s/g, '')
  }
  referal = referal.replace('update', '')
  if (status == 'admitted') {
    referal = referal.replace('admitted', '')
    referal = referal.replace('admited', '')
    referal = referal.replace('adm', '')
  } else if (status == 'discharged') {
    referal = referal.replace('discharged', '')
    referal = referal.replace('discharge', '')
    referal = referal.replace('disch', '')
  }
  referalID = referal.replace(/\s/g, '')
  if (!referalID) {
    let sms = `Please include referal ID in your sms`
    let phone = ['tel:' + HFSphone]
    rapidpro.broadcast({
      tels: phone,
      sms
    })
    return
  }
  res.status(200).send()
  mongo.updateReferal(referalID, status, HFSphone, () => {
    winston.error('done')
  })
})

app.all('/clinicReminder', (req, res) => {
  rapidpro.clinicReminder((err) => {
    if (err) {
      res.status(500).send()
    } else {
      res.status(200).send()
    }
  })
})

app.get('/syncLocations', (req, res) => {
  async.series({
    regions: (callback) => {
      mongo.getRegions('', (err, data) => {
        if (data) {
          data = JSON.parse(JSON.stringify(data))
          async.eachSeries(data, (dt, nxtDt) => {
            aggregator.addLocationToXLSForm(dt._id, dt.name, '', 'regions', () => {
              return nxtDt()
            })
          }, () => {
            return callback(false)
          })
        } else {
          return callback(false)
        }
      })
    },
    districts: (callback) => {
      mongo.getDistricts('', (err, data) => {
        if (data) {
          data = JSON.parse(JSON.stringify(data))
          async.eachSeries(data, (dt, nxtDt) => {
            aggregator.addLocationToXLSForm(dt._id, dt.name, dt.parent._id, 'districts', () => {
              return nxtDt()
            })
          }, () => {
            return callback(false)
          })
        } else {
          return callback(false)
        }
      })
    },
    villages: (callback) => {
      mongo.getVillages('', (err, data) => {
        if (data) {
          data = JSON.parse(JSON.stringify(data))
          async.eachSeries(data, (dt, nxtDt) => {
            aggregator.addLocationToXLSForm(dt._id, dt.name, dt.parent.parent, 'villages', () => {
              return nxtDt()
            })
          }, () => {
            return callback(false)
          })
        } else {
          return callback(false)
        }
      })
    }
  })
})

app.get('/syncContacts', (req, res) => {
  async.parallel({
    chaSync: (callback) => {
      mongo.getCHA(null, (err, data) => {
        async.each(data, (cha, nxtCha) => {
          let urns = ["tel:+255" + cha.phone1.substring(1)]
          if (cha.phone2 && cha.phone.length == 10) {
            urns.push("tel:+255" + cha.phone2.substring(1))
          }
          let contact = {
            "name": cha.firstName + " " + cha.otherName + " " + cha.surname,
            "urns": urns,
            "fields": {
              "chadid": cha._id,
              "category": "CHA",
              "village": cha.village._id
            }
          }
          rapidpro.addContact(contact, (err, newContact) => {
            if (!err) {
              mongo.updateCHARapidproId(newContact.fields.chadid, newContact.uuid, () => {
                return nxtCha()
              })
            } else {
              return nxtCha()
            }
          })
        }, () => {
          return callback(null, null)
        })
      })
    },
    hfsSync: (callback) => {
      mongo.getHFS(null, (err, data) => {
        async.each(data, (cha, nxtHfs) => {
          let urns = ["tel:+255" + cha.phone1.substring(1)]
          if (cha.phone2 && cha.phone2.length == 10) {
            urns.push("tel:+255" + cha.phone2.substring(1))
          }
          let contact = {
            "name": cha.firstName + " " + cha.otherName + " " + cha.surname,
            "urns": urns,
            "fields": {
              "chadid": cha._id,
              "category": "HFS",
              "facility": cha.facility._id
            }
          }
          rapidpro.addContact(contact, (err, newContact) => {
            if (!err) {
              mongo.updateHFSRapidproId(newContact.fields.chadid, newContact.uuid, () => {
                return nxtHfs()
              })
            } else {
              return nxtHfs()
            }
          })
        }, () => {
          return callback(null, null)
        })
      })
    }
  }, () => {
    winston.info("Contacts sync is done")
  })
})

app.listen(port, () => {
  winston.info("Server is running and listening on port " + port)
  let db = mongoose.connection
  db.on("error", console.error.bind(console, "connection error:"))
  db.once("open", () => {
    models.UsersModel.find({
      userName: "root@bmf.org"
    }).lean().exec((err, data) => {
      if (data.length == 0) {
        winston.info("Default user not found, adding now ...")
        let roles = [{
            "name": "Admin"
          },
          {
            "name": "Data Manager"
          }
        ]
        models.RolesModel.collection.insertMany(roles, (err, data) => {
          models.RolesModel.find({
            name: "Admin"
          }, (err, data) => {
            let User = new models.UsersModel({
              firstName: "Root",
              surname: "Root",
              userName: "root@bmf.org",
              status: "Active",
              role: data[0]._id,
              password: bcrypt.hashSync("chad", 8)
            })
            User.save((err, data) => {
              if (err) {
                winston.error(err)
                winston.error('Unexpected error occured,please retry')
              } else {
                winston.info('Admin User added successfully')
              }
            })
          })
        })
      }
    })
  })
})
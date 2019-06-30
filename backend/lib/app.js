require('./init');
const express = require('express')
const winston = require('winston')
const async = require('async')
const Excel = require('exceljs')
const mongoose = require('mongoose')
const moment = require('moment')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors');
const bodyParser = require('body-parser');
var guiRouter = require('./routes/gui')
const aggregator = require('./aggregator')
const mixin = require('./mixin')
const rapidpro = require('./rapidpro')
const config = require('./config')
const models = require('./models')
const mongo = require('./mongo')()
require('./clone')
const port = config.getConf('server:port')
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

const app = express()

let jwtValidator = function (req, res, next) {
  if (req.method == "OPTIONS" ||
    req.path == "/authenticate/" ||
    req.path == "/test" ||
    req.path == "/newSubmission" ||
    req.path == "/clinicReminder" ||
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

app.all('/test', (req, res) => {
  winston.error('here')
  let submission = req.body
  mongo.saveSubmission(submission)
})

app.all('/populateData', (req, res) => {
  let householdFormID = config.getConf("aggregator:householdForm:id")
  let householdFormName = config.getConf("aggregator:householdForm:name")
  winston.info("Received a request to update houses in XLSForm")
  aggregator.downloadXLSForm(householdFormID, householdFormName, (err) => {
    if (err) {
      return res.status(500).send()
    }
    aggregator.downloadFormData(householdFormID, (err, formData) => {
      try {
        formData = JSON.parse(formData)
      } catch (error) {
        winston.error(error)
        winston.error("invalid data returned by aggregator, stop updating villages")
        return res.status(500).send()
      }
      getWorkbook(__dirname + '/' + householdFormName + '.xlsx', (chadWorkbook) => {
        //loop through online aggregator formData and compare against
        async.each(formData, (data, nxt) => {
          let keys = Object.keys(data)
          let pregnant_wom_name, pregnant_wom_age, pregnant_wom_name_new, pregnant_wom_age_new
          if (keys.includes('pregnant_woman_name_new')) {
            pregnant_wom_name_new = data['pregnant_woman_name_new']
          } else {
            let preg_name_key = getKeys(keys, 'pregnant_woman_name_new')
            if (preg_name_key) {
              pregnant_wom_name_new = data[preg_name_key]
            }
          }
          if (keys.includes('pregnant_woman_name')) {
            pregnant_wom_name = data['pregnant_woman_name']
          } else {
            let preg_name_key = getKeys(keys, 'pregnant_woman_name')
            if (preg_name_key) {
              pregnant_wom_name = data[preg_name_key]
            }
          }
          if (keys.includes('pregnant_woman_age_new')) {
            pregnant_wom_age_new = data['pregnant_woman_age_new']
          } else {
            let preg_age_key = getKeys(keys, 'pregnant_woman_age_new')
            if (preg_age_key) {
              pregnant_wom_age_new = data[preg_age_key]
            }
          }
          if (data.house_name != 'add_new' && pregnant_wom_name != 'add_new') {
            return nxt()
          }
          let house_name = data.house_name_new
          let house_number = data.house_number_new
          if (data.house_name != 'add_new') {
            house_number = data.house_name.split('-').pop()
            house_name = data.house_name.split('-')[0]
          }
          let chadChoicesWorksheet = chadWorkbook.getWorksheet('choices')
          let add_preg_woman, add_house
          if (pregnant_wom_name == 'add_new') {
            add_preg_woman = true
          }
          if (data.house_name == 'add_new') {
            add_house = true
          }
          const chadPromises = []
          chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
            chadPromises.push(new Promise((resolve, reject) => {
              if (!chadRows.values.includes('house_name') && !chadRows.values.includes('pregnant_women')) {
                return resolve()
              }
              if (chadRows.values.includes('house_name') && chadRows.values.includes(house_name + ' - ' + house_number)) {
                add_house = false
              }
              let preg_wom_label = pregnant_wom_name_new + ' - ' + pregnant_wom_age_new + ' - ' + house_number
              if (chadRows.values.includes('pregnant_women') && chadRows.values.includes(preg_wom_label)) {
                add_preg_woman = false
              }
              return resolve()
            }))
          })
          Promise.all(chadPromises).then(() => {
            async.series({
              house: (callback) => {
                if (add_house) {
                  let lastRow = chadChoicesWorksheet.lastRow
                  let getRowInsert = chadChoicesWorksheet.getRow(++(lastRow.number))
                  getRowInsert.getCell(1).value = 'house_name'
                  getRowInsert.getCell(2).value = house_number
                  getRowInsert.getCell(3).value = house_name + ' - ' + house_number
                  getRowInsert.getCell(4).value = data['village']
                  getRowInsert.commit()
                  return callback(null, null)
                } else {
                  return callback(null, null)
                }
              },
              preg_wom: (callback) => {
                if (add_preg_woman) {
                  let lastRow = chadChoicesWorksheet.lastRow
                  let getRowInsert = chadChoicesWorksheet.getRow(++(lastRow.number))
                  getRowInsert.getCell(1).value = 'pregnant_women'
                  getRowInsert.getCell(2).value = pregnant_wom_name_new + ' - ' + pregnant_wom_age_new + ' - ' + house_number
                  getRowInsert.getCell(3).value = pregnant_wom_name_new + ' - ' + pregnant_wom_age_new + ' - ' + house_number
                  getRowInsert.getCell(4).value = house_number
                  getRowInsert.commit()
                  return callback(null, null)
                } else {
                  return callback(null, null)
                }
              }
            }, (err, results) => {
              return nxt()
            })
          }).catch((err) => {
            winston.error(err)
          })
        }, () => {
          winston.info('writting any changes into local household_visit XLSForm')
          chadWorkbook.xlsx.writeFile(__dirname + '/' + householdFormName + '.xlsx').then(() => {
            winston.info('Updating the online CHAD XLSForm with the local household XLSForm')
            aggregator.publishForm(householdFormID, householdFormName, () => {
              winston.info('Online household XLSForm Updated')
              res.status(200).send()
            })
          })
        })
      })
    })
  })

  function getKeys(keys, key_name) {
    let key_found = keys.find((key) => {
      return key.endsWith('/' + key_name)
    })
    return key_found
  }

  function getWorkbook(filename, callback) {
    let workbook = new Excel.Workbook()
    workbook.xlsx.readFile(filename).then(() => {
      return callback(workbook)
    }).catch((err) => {
      console.log(err)
    })
  }
})

app.post('/newSubmission', (req, res) => {
  //acknowlodge recipient
  res.status(200).send()
  winston.info('New submission received')
  let householdFormID = config.getConf("aggregator:householdForm:id")
  let householdFormName = config.getConf("aggregator:householdForm:name")
  let submission = req.body
  // populate any new house/ pregnant woman as a choice
  aggregator.downloadXLSForm(householdFormID, householdFormName, (err) => {
    getWorkbook(__dirname + '/' + householdFormName + '.xlsx', (chadWorkbook) => {
      let chadChoicesWorksheet = chadWorkbook.getWorksheet('choices')
      let house_name = mixin.getDataFromJSON(submission, 'house_name')
      let pregnant_woman_name = mixin.getDataFromJSON(submission, 'pregnant_woman_name')
      async.series({
        new_house: (callback) => {
          if (house_name == 'add_new') {
            let new_house_name = mixin.getDataFromJSON(submission, 'house_name_new')
            let new_house_number = mixin.getDataFromJSON(submission, 'house_number_new')
            let village = mixin.getDataFromJSON(submission, 'village')
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
          if (pregnant_woman_name == 'add_new') {
            let new_preg_woman_name = mixin.getDataFromJSON(submission, 'pregnant_woman_name_new')
            let new_pregnant_woman_age = mixin.getDataFromJSON(submission, 'pregnant_woman_age_new')
            let house_number
            house_number = mixin.getDataFromJSON(submission, 'house_number_new')
            if (!house_number) {
              house_number = mixin.getDataFromJSON(submission, 'house_number')
            }
            aggregator.populatePregnantWomen(chadChoicesWorksheet, new_preg_woman_name, new_pregnant_woman_age, house_number, (err) => {
              winston.info('writting new pregnant woman into local household_visit XLSForm')
              chadWorkbook.xlsx.writeFile(__dirname + '/' + householdFormName + '.xlsx').then(() => {
                return callback(false, false)
              })
            })
          } else {
            return callback(false, false)
          }
        }
      }, () => {
        winston.info('Updating the online CHAD XLSForm with the local household XLSForm')
        aggregator.publishForm(householdFormID, householdFormName, () => {
          winston.info('Online household XLSForm Updated')
        })
      })

      // check if needs referal
      // check pregnant woman referral
      if (submission.hasOwnProperty('rp_preg_woman')) {
        async.each(submission.rp_preg_woman, (preg_wom, nxtPregWom) => {
          // Schedule a reminder for clinic
          let house_number = mixin.getDataFromJSON(submission, 'house_name')
          if (house_number == 'add_new') {
            house_number = mixin.getDataFromJSON(submission, 'house_number_new')
          }
          last_clin_vis = mixin.getDataFromJSON(preg_wom, 'forth_visit_above')
          if (!last_clin_vis) {
            last_clin_vis = mixin.getDataFromJSON(preg_wom, 'third_visit')
            if (!last_clin_vis) {
              last_clin_vis = mixin.getDataFromJSON(preg_wom, 'second_visit')
              if (!last_clin_vis) {
                last_clin_vis = mixin.getDataFromJSON(preg_wom, 'first_visit')
              }
            }
          }
          let last_menstrual = mixin.getDataFromJSON(preg_wom, 'last_menstrual_period')
          let preg_wom_name = mixin.getDataFromJSON(preg_wom, 'pregnant_woman_name')
          if (preg_wom_name === 'add_new') {
            preg_wom_name = mixin.getDataFromJSON(preg_wom, 'pregnant_woman_name_new')
            let preg_wom_age = mixin.getDataFromJSON(preg_wom, 'pregnant_woman_age_new')
            mongo.addPregnantWoman(house_number, preg_wom_name, preg_wom_age, last_clin_vis, last_menstrual, submission.username)
          } else if (preg_wom_name !== 'add_new') {
            let preg_wom_name_arr = preg_wom_name.split('-')
            preg_wom_name = preg_wom_name_arr.shift().trim()
            preg_wom_age = preg_wom_name_arr.shift().trim()
            mongo.updatePregnantWoman(house_number, preg_wom_name, preg_wom_age, last_clin_vis, last_menstrual, submission.username)
          }
          // end of scheduling a reminder for clinic

          let danger_signs = mixin.getDataFromJSON(preg_wom, 'danger_signs')
          if (danger_signs) {
            let sms = "Patient:Pregnant Woman \\n Issues:"
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
      if (submission.hasOwnProperty('rp_breast_feed_mother')) {
        async.each(submission.rp_breast_feed_mother, (postnatal_mthr, nxtPostnatalMthr) => {
          let psigns = mixin.getDataFromJSON(postnatal_mthr, 'puperium_danger_signs')
          let signs = []
          if (psigns) {
            signs = psigns.split(" ")
          }
          if (signs.length > 0) {
            let sms = "Patient:Postnatal mother \\n Issues:"
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
      if (submission.hasOwnProperty('rp_breast_feed_mother')) {
        async.each(submission.rp_breast_feed_mother, (postnatal_mthr, nxtNeonatalChild) => {
          let neo_babies = mixin.getDataFromJSON(postnatal_mthr, 'rp_neonatal_baby')
          async.each(neo_babies, (neo_baby, nxtNeoBaby) => {
            let nsigns = mixin.getDataFromJSON(neo_baby, 'neonatal_danger_sign')
            let signs = []
            if (nsigns) {
              signs = nsigns.split(" ")
            }

            if (signs.length > 0) {
              let sms = "Patient:Neonatal baby \\n Issues:"
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
      let under_5 = mixin.getDataFromJSON(submission, 'rp_children_under_5')
      if (under_5 && under_5.length > 0) {
        async.each(under_5, (susp_pat, nxtSuspPat) => {
          let danger_signs = mixin.getDataFromJSON(susp_pat, 'danger_signs_child')
          if (danger_signs) {
            let sms = "Patient:Children under 5 \\n Issues:"
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
      let sick_person = mixin.getDataFromJSON(submission, 'rp_sick_person')
      if (sick_person && sick_person.length > 0) {
        async.each(sick_person, (susp_pat, nxtSuspPat) => {
          let danger_signs = mixin.getDataFromJSON(susp_pat, 'general_examination')
          if (danger_signs) {
            let sms = "Patient:Sick person \\n Issues:"
            let issues = ''
            danger_signs = danger_signs.split(" ")
            async.eachSeries(danger_signs, (danger_sign, nxtDangerSign) => {
              if (danger_sign === 'others') {
                if (issues) {
                  issues += ", "
                }
                issues += mixin.getDataFromJSON(susp_pat, 'general_examination_others')
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

app.all('/clinicReminder', (req, res) => {
  rapidpro.clinicReminder((err) => {
    if (err) {
      res.status(500).send()
    } else {
      res.status(200).send()
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
  mongoose.connect(mongoURI);
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
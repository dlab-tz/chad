require('../init')
const formidable = require('formidable')
const moment = require('moment');
const winston = require('winston')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const async = require('async')
var express = require('express')
var router = express.Router()
const config = require('../config')
const mongo = require('../mongo')()
const rapidpro = require('../rapidpro')
const models = require('../models')
const aggregator = require('../aggregator')
const mongoUser = config.getConf("DB_USER")
const mongoPasswd = config.getConf("DB_PASSWORD")
const mongoHost = config.getConf("DB_HOST")
const mongoPort = config.getConf("DB_PORT")
const database = config.getConf("DB_NAME")

router.post('/authenticate', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    winston.info('Authenticating user ' + fields.username)

    if (mongoUser && mongoPasswd) {
      var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
    } else {
      var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
    }
    mongoose.connect(uri);
    let db = mongoose.connection
    db.on("error", console.error.bind(console, "connection error:"))
    db.once("open", () => {
      models.UsersModel.find({
        userName: fields.username,
        $or: [{
          status: 'Active'
        }, {
          status: ''
        }, {
          status: undefined
        }]
      }).lean().exec((err, data) => {
        if (data.length === 1) {
          let userID = data[0]._id.toString()
          let passwordMatch = bcrypt.compareSync(fields.password, data[0].password);
          if (passwordMatch) {
            let tokenDuration = config.getConf('auth:tokenDuration')
            let secret = config.getConf('auth:secret')
            let token = jwt.sign({
              id: data[0]._id.toString()
            }, secret, {
              expiresIn: tokenDuration
            })
            // get role name
            models.RolesModel.find({
              _id: data[0].role
            }).lean().exec((err, roles) => {
              let role = null
              if (roles.length === 1) {
                role = roles[0].name
              }
              winston.info('Successfully Authenticated user ' + fields.username)
              res.status(200).json({
                token,
                role,
                userID
              })
            })
          } else {
            winston.info('Failed Authenticating user ' + fields.username)
            res.status(200).json({
              token: null,
              role: null,
              userID: null
            })
          }
        } else {
          winston.info('Failed Authenticating user ' + fields.username)
          res.status(200).json({
            token: null,
            role: null,
            userID: null
          })
        }
      })
    })
  })
})

router.get('/getRegions/:id?', (req, res) => {
  winston.info("Received a request to get regions")
  let id = req.params.id
  mongo.getRegions(id, (err, data) => {
    if (err) {
      return res.status(500).send()
    }
    data = JSON.parse(JSON.stringify(data))
    res.status(200).json(data)
  })
})

router.get('/getDistricts/:id?', (req, res) => {
  winston.info("Received a request to get districts")
  let id = req.params.id
  mongo.getDistricts(id, (err, data) => {
    if (err) {
      return res.status(500).send()
    }
    data = JSON.parse(JSON.stringify(data))
    res.status(200).json(data)
  })
})

router.get('/getFacilities/:id?', (req, res) => {
  winston.info("Received a request to get facilities")
  let id = req.params.id
  mongo.getFacilities(id, (err, data) => {
    if (err) {
      return res.status(500).send()
    }
    data = JSON.parse(JSON.stringify(data))
    res.status(200).json(data)
  })
})

router.get('/getVillages/:id?', (req, res) => {
  winston.info("Received a request to get villages")
  let id = req.params.id
  mongo.getVillages(id, (err, data) => {
    if (err) {
      return res.status(500).send()
    }
    data = JSON.parse(JSON.stringify(data))
    res.status(200).json(data)
  })
})

router.get('/getCHAByVillage/:id?', (req, res) => {
  winston.info("Received a request to get CHA by village")
  let id = req.params.id
  mongo.getVillages(id, (err, data) => {
    if (err) {
      return res.status(500).send()
    }
    data = JSON.parse(JSON.stringify(data))
    res.status(200).json(data)
  })
})

router.get('/getCHAById/:id?', (req, res) => {
  winston.info("Received a request to get CHA by ID")
  let id = req.params.id
  mongo.getCHA(id, (err, data) => {
    if (err) {
      return res.status(500).send()
    }
    data = JSON.parse(JSON.stringify(data))
    res.status(200).json(data)
  })
})

router.get('/getHFSById/:id?', (req, res) => {
  winston.info("Received a request to get HFS by ID")
  let id = req.params.id
  mongo.getHFS(id, (err, data) => {
    if (err) {
      return res.status(500).send()
    }
    data = JSON.parse(JSON.stringify(data))
    res.status(200).json(data)
  })
})

router.post('/editLocation', (req, res) => {
  winston.info("Received a request to edit location")
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    let name = fields.name
    let id = fields.id
    let type = fields.type
    parent = fields.parent
    mongo.editLocation(id, name, type, parent, (err, data) => {
      if (err) {
        winston.error(err)
        res.status(500).json({
          error: "Internal error occured"
        })
      } else {
        res.status(200).json({
          id: data._id
        })
      }
    })
  })
})

router.delete('/deleteLocation/:id/:type', (req, res) => {
  winston.info("Received a request to delete location")
  const database = config.getConf("DB_NAME")

  if (mongoUser && mongoPasswd) {
    var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
  } else {
    var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
  }
  mongoose.connect(uri, {}, () => {
    let model = req.params.type + 'Model'
    let id = req.params.id
    models[model].deleteOne({
      _id: id
    }, (err, data) => {
      if (err) {
        winston.error(err)
        res.status(500).json({
          error: "Internal error occured"
        })
      } else {
        res.status(200).json({
          id: data._id
        })
      }
    })
  })
})

router.post('/addUser', (req, res) => {
  winston.info("Received a signup request")
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    const database = config.getConf("DB_NAME")

    if (mongoUser && mongoPasswd) {
      var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
    } else {
      var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
    }
    mongoose.connect(uri, {}, () => {
      models.RolesModel.find({
        name: "Data Manager"
      }, (err, data) => {
        if (data) {
          let User = new models.UsersModel({
            firstName: fields.firstName,
            otherName: fields.otherName,
            surname: fields.surname,
            userName: fields.userName,
            status: "Active",
            role: fields.role,
            password: bcrypt.hashSync(fields.password, 8)
          })
          User.save((err, data) => {
            if (err) {
              winston.error(err)
              res.status(500).json({
                error: "Internal error occured"
              })
            } else {
              winston.info("User created successfully")
              res.status(200).json({
                id: data._id
              })
            }
          })
        } else {
          if (err) {
            winston.error(err)
          }
          res.status(500).json({
            error: "Internal error occured"
          })
        }
      })
    })
  })
})

router.post('/changePassword', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    winston.info("Received a request to change password for userID " + fields.id)
    mongo.resetPassword(fields.id, bcrypt.hashSync(fields.password, 8), (error, resp) => {
      if (error) {
        winston.error(error)
        return res.status(400).send()
      } else {
        res.status(200).send()
      }
    })
  })
})

router.get('/getRoles/:id?', (req, res) => {
  winston.info("Received a request to get roles")
  const database = config.getConf("DB_NAME")

  if (mongoUser && mongoPasswd) {
    var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
  } else {
    var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
  }
  mongoose.connect(uri);
  let db = mongoose.connection
  db.on("error", console.error.bind(console, "connection error:"))
  db.once("open", () => {
    let idFilter
    if (req.params.id) {
      idFilter = {
        _id: req.params.id
      }
    } else {
      idFilter = {}
    }
    models.RolesModel.find(idFilter).lean().exec((err, roles) => {
      winston.info(`sending back a list of ${roles.length} roles`)
      res.status(200).json(roles)
    })
  })
})

router.get('/getUsers', (req, res) => {
  winston.info("received a request to get users lists")
  const database = config.getConf("DB_NAME")
  if (mongoUser && mongoPasswd) {
    var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
  } else {
    var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
  }
  mongoose.connect(uri);
  let db = mongoose.connection
  db.on("error", console.error.bind(console, "connection error:"))
  db.once("open", () => {
    models.UsersModel.find({}).populate("role").lean().exec((err, users) => {
      winston.info(`sending back a list of ${users.length} users`)
      res.status(200).json(users)
    })
  })
})

router.post('/addRegion', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    winston.info("Received a request to add a region")
    if (mongoUser && mongoPasswd) {
      var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
    } else {
      var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
    }
    mongoose.connect(uri, {}, () => {
      let Region = new models.RegionsModel({
        name: fields.name,
      })
      Region.save((err, data) => {
        if (err) {
          winston.error(err)
          res.status(500).json({
            error: "Internal error occured"
          })
        } else {
          winston.info("Region saved successfully")
          res.status(200).json({
            id: data._id
          })
          data = JSON.parse(JSON.stringify(data))
          aggregator.addLocationToXLSForm(data._id, fields.name, '', 'regions', () => {})
        }
      })
    })
  })
})

router.post('/addDistrict', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    winston.info("Received a request to add a district")
    if (mongoUser && mongoPasswd) {
      var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
    } else {
      var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
    }
    mongoose.connect(uri, {}, () => {
      let District = new models.DistrictsModel({
        name: fields.name,
        parent: fields.parent
      })
      District.save((err, data) => {
        if (err) {
          winston.error(err)
          res.status(500).json({
            error: "Internal error occured"
          })
        } else {
          winston.info("District saved successfully")
          res.status(200).json({
            id: data._id
          })
          data = JSON.parse(JSON.stringify(data))
          aggregator.addLocationToXLSForm(data._id, fields.name, fields.parent, 'districts', () => {})
        }
      })
    })
  })
})

router.post('/addFacility', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    winston.info("Received a request to add a facility")
    if (mongoUser && mongoPasswd) {
      var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
    } else {
      var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
    }
    mongoose.connect(uri, {}, () => {
      let Facility = new models.FacilitiesModel({
        name: fields.name,
        parent: fields.parent
      })
      Facility.save((err, data) => {
        if (err) {
          winston.error(err)
          res.status(500).json({
            error: "Internal error occured"
          })
        } else {
          winston.info("Facility saved successfully")
          res.status(200).json({
            id: data._id
          })
        }
      })
    })
  })
})

router.post('/addVillage', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    winston.info("Received a request to add a village")
    if (mongoUser && mongoPasswd) {
      var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
    } else {
      var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
    }
    mongoose.connect(uri, {}, () => {
      let Village = new models.VillagesModel({
        name: fields.name,
        parent: fields.parent
      })
      Village.save((err, data) => {
        if (err) {
          winston.error(err)
          res.status(500).json({
            error: "Internal error occured"
          })
        } else {
          winston.info("Village saved successfully")
          res.status(200).json({
            id: data._id
          })
          data = JSON.parse(JSON.stringify(data))
          let villageId = data._id
          mongo.getVillages(data._id, (err, data) => {
            if (data) {
              data = JSON.parse(JSON.stringify(data))
              aggregator.addLocationToXLSForm(villageId, fields.name, data[0].parent.parent, 'villages', () => {})
            }
          })
        }
      })
    })
  })
})

router.post('/addCHA', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    winston.info("Received a request to add a CHA")
    if (mongoUser && mongoPasswd) {
      var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
    } else {
      var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
    }
    if (!fields.phone2) {
      fields.phone2 = null
    }
    if (!fields.otherName) {
      fields.otherName = null
    }
    mongoose.connect(uri, {}, () => {
      let CHA = new models.CHAModel({
        firstName: fields.firstName,
        otherName: fields.otherName,
        surname: fields.surname,
        email: fields.email,
        phone1: fields.phone1,
        phone2: fields.phone2,
        odkUsername: fields.odkUsername,
        village: fields.village
      })
      CHA.save((err, data) => {
        if (err) {
          winston.error(err)
          res.status(500).json({
            error: "Internal error occured"
          })
        } else {
          let urns = ["tel:+255" + fields.phone1.substring(1)]
          if (fields.phone2 && fields.phone2.length === 10 && /^\d+$/.test(fields.phone2.substring(1))) {
            urns.push("tel:+255" + fields.phone2.substring(1))
          }
          let contact = {
            "name": fields.firstName + " " + fields.otherName + " " + fields.surname,
            "urns": urns,
            "fields": {
              "chadid": data._id,
              "category": "CHA",
              "village": fields.village
            }
          }
          rapidpro.addContact(contact, (err, newContact) => {
            if (!err) {
              mongo.updateCHARapidproId(newContact.fields.chadid, newContact.uuid, () => {

              })
            }
          })
          aggregator.createAccount(fields, () => {
            winston.info("CHA saved successfully")
            res.status(200).json({
              id: data._id
            })
          })
        }
      })
    })
  })
})

router.post('/editCHA', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    fields.cha = JSON.parse(fields.cha)
    winston.info("Received a request to update] a CHA")
    if (mongoUser && mongoPasswd) {
      var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
    } else {
      var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
    }
    if (!fields.cha.phone2) {
      fields.cha.phone2 = null
    }
    if (!fields.otherName) {
      fields.otherName = null
    }
    mongoose.connect(uri, {}, () => {
      let updates = {
        firstName: fields.cha.firstName,
        otherName: fields.cha.otherName,
        surname: fields.cha.surname,
        email: fields.cha.email,
        phone1: fields.cha.phone1,
        phone2: fields.cha.phone2,
        odkUsername: fields.cha.odkUsername,
        village: fields.cha.village._id
      }
      mongoose.set('useFindAndModify', false)
      models.CHAModel.findByIdAndUpdate(fields.cha._id, updates, (err, data) => {
        if (err) {
          winston.error(err)
          res.status(500).json({
            error: "Internal error occured"
          })
        } else {
          res.status(200).json({
            id: data._id
          })
          let urns = ["tel:+255" + fields.cha.phone1.substring(1)]
          if (fields.cha.phone2 && fields.cha.phone2.length === 10 && /^\d+$/.test(fields.cha.phone2.substring(1))) {
            urns.push("tel:+255" + fields.cha.phone2.substring(1))
          }
          let contact = {
            "name": fields.cha.firstName + " " + fields.cha.otherName + " " + fields.cha.surname,
            "uuid": fields.cha.rapidproId,
            "urns": urns,
            "fields": {
              "chadid": data._id,
              "category": "CHA",
              "village": fields.cha.village._id
            }
          }
          rapidpro.addContact(contact, (err, newContact) => {
            if (!err) {
              mongo.updateCHARapidproId(fields.cha._id, newContact.uuid, () => {

              })
            }
          })
        }
      })
    })
  })
})

router.post('/editHFS', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    fields.hfs = JSON.parse(fields.hfs)
    winston.info("Received a request to update] a HFS")
    if (mongoUser && mongoPasswd) {
      var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
    } else {
      var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
    }
    if (!fields.hfs.phone2) {
      fields.hfs.phone2 = null
    }
    if (!fields.otherName) {
      fields.otherName = null
    }
    winston.error(JSON.stringify(fields.hfs))
    mongoose.connect(uri, {}, () => {
      let updates = {
        firstName: fields.hfs.firstName,
        otherName: fields.hfs.otherName,
        surname: fields.hfs.surname,
        email: fields.hfs.email,
        phone1: fields.hfs.phone1,
        phone2: fields.hfs.phone2,
        facility: fields.hfs.facility._id
      }
      mongoose.set('useFindAndModify', false)
      winston.error(fields.hfs._id)
      models.HFSModel.findByIdAndUpdate(fields.hfs._id, updates, (err, data) => {
        if (err) {
          winston.error(err)
          res.status(500).json({
            error: "Internal error occured"
          })
        } else {
          res.status(200).json({
            id: data._id
          })
          let urns = ["tel:+255" + fields.hfs.phone1.substring(1)]
          if (fields.hfs.phone2 && fields.hfs.phone2.length === 10 && /^\d+$/.test(fields.hfs.phone2.substring(1))) {
            urns.push("tel:+255" + fields.hfs.phone2.substring(1))
          }
          let contact = {
            "name": fields.hfs.firstName + " " + fields.hfs.otherName + " " + fields.hfs.surname,
            "uuid": fields.hfs.rapidproId,
            "urns": urns,
            "fields": {
              "hfsdid": data._id,
              "category": "hfs",
              "facility": fields.hfs.facility._id
            }
          }
          rapidpro.addContact(contact, (err, newContact) => {
            if (!err) {
              mongo.updatehfsRapidproId(fields.hfs._id, newContact.uuid, () => {

              })
            }
          })
        }
      })
    })
  })
})

router.post('/usernameExist', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    if (mongoUser && mongoPasswd) {
      var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
    } else {
      var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
    }
    mongoose.connect(uri, {}, () => {
      models.CHAModel.find({
        odkUsername: fields.username
      }, (err, data) => {
        res.status(200).json(data)
      })
    })
  })
})

router.post('/addHFS', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    winston.info("Received a request to add a CHA")
    if (mongoUser && mongoPasswd) {
      var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
    } else {
      var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
    }
    mongoose.connect(uri, {}, () => {
      let HFS = new models.HFSModel({
        firstName: fields.firstName,
        otherName: fields.otherName,
        surname: fields.surname,
        email: fields.email,
        phone1: fields.phone1,
        phone2: fields.phone2,
        facility: fields.facility
      })
      HFS.save((err, data) => {
        if (err) {
          winston.error(err)
          res.status(500).json({
            error: "Internal error occured"
          })
        } else {
          let urns = ["tel:+255" + fields.phone1.substring(1)]
          let contact = {
            "name": fields.firstName + " " + fields.otherName + " " + fields.surname,
            "urns": urns,
            "fields": {
              "chadid": data._id,
              "category": "HFS",
              "facility": fields.facility
            }
          }
          rapidpro.addContact(contact, (err, newContact) => {
            if (!err) {
              mongo.updateHFSRapidproId(newContact.fields.chadid, newContact.uuid, () => {

              })
            }
          })
          winston.info("HFS saved successfully")
          res.status(200).json({
            id: data._id
          })
        }
      })
    })
  })
})

router.get('/getSubmissions', (req, res) => {
  let startDate = req.query.startDate
  let endDate = req.query.endDate
  winston.info("Receved request to get submission data")
  mongo.getSubmissions(startDate, endDate, (err, data) => {
    if (err) {
      res.status(500).send()
    } else {
      res.status(200).json(data)
    }
  })
})

router.get('/getSubmissionsReport', (req, res) => {
  let month = req.query.month
  let startDate = moment(month, "YYYY-MM").startOf('month').format('YYYY-MM-DD')
  let endDate = moment(month, "YYYY-MM").endOf('month').format('YYYY-MM-DD')
  winston.info("Receved request to get submission data")
  mongo.getSubmissions(startDate, endDate, (err, data) => {
    if (err) {
      res.status(500).send()
    } else {
      let report = []
      const promises = []
      for (let submission of data) {
        promises.push(new Promise((resolve, reject) => {
          mongo.getVillages(submission.village, (err, data) => {
            if (Array.isArray(data) && data.length > 0) {
              let village = data[0].name
              let found = false
              for (let index in report) {
                if (report[index].chw === submission.CHA_name && report[index].village === village) {
                  let totalHouseholds = parseInt(report[index].househoulds)
                  report[index].househoulds = totalHouseholds + 1
                  found = true
                }
              }
              if (!found) {
                report.push({
                  chw: submission.CHA_name,
                  village,
                  househoulds: 1
                })
              }
            }
            resolve()
          })
        }))
      }
      Promise.all(promises).then(() => {
        res.status(200).json(report)
      })
    }
  })
})

router.get('/location/:type', (req, res) => {
  let model = req.params.type + 'Model'
  let id = req.query.id
  let query
  if (id) {
    query = {
      id: id
    }
  } else {
    query = {}
  }
  if (mongoUser && mongoPasswd) {
    var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
  } else {
    var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
  }
  mongoose.connect(uri, {}, () => {
    models[model].find(query, (err, data) => {
      data = JSON.parse(JSON.stringify(data))
      res.status(200).json(data)
    })
  })
})

router.get('/locationTree', (req, res) => {
  let id = req.query.id
  let type = req.query.type
  let lastLocationType = req.query.lastLocationType
  let checkChild = JSON.parse(req.query.checkChild)
  let model, childModel, typeTag
  if (!type) {
    model = "RegionsModel"
    childModel = "DistrictsModel"
    typeTag = "region"
  } else if (type === 'region') {
    model = 'DistrictsModel'
    childModel = "FacilitiesModel"
    typeTag = "district"
  } else if (type === 'district') {
    model = 'FacilitiesModel'
    childModel = "VillagesModel"
    typeTag = "facility"
  } else {
    model = 'VillagesModel'
    childModel = null
    typeTag = "village"
  }

  let query
  if (id) {
    query = {
      parent: id
    }
  } else {
    query = {}
  }
  if (mongoUser && mongoPasswd) {
    var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
  } else {
    var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
  }
  mongoose.connect(uri, {}, () => {
    models[model].find(query, (err, data1) => {
      data1 = JSON.parse(JSON.stringify(data1))
      async.eachOf(data1, (dt, index, nxtDt) => {
        let id = data1[index]._id
        delete data1[index]._id
        data1[index].id = id
        data1[index].typeTag = typeTag
        if (childModel && checkChild) {
          models[childModel].find({
            'parent': dt.id
          }, (err, data2) => {
            if (data2.length > 0 && lastLocationType != typeTag) {
              data1[index].children = []
            }
            return nxtDt()
          })
        } else if (childModel) {
          if (lastLocationType != typeTag) {
            data1[index].children = []
          }
          return nxtDt()
        } else {
          return nxtDt()
        }
      }, () => {
        res.status(200).json(data1)
      })
    })
  })
})

router.get('/getLocationTree/:type', (req, res) => {
  if (mongoUser && mongoPasswd) {
    var uri = `mongodb://${mongoUser}:${mongoPasswd}@${mongoHost}:${mongoPort}/${database}`;
  } else {
    var uri = `mongodb://${mongoHost}:${mongoPort}/${database}`;
  }
  regions = []
  mongoose.connect(uri, {}, () => {
    models.RegionsModel.find({}, (err, data) => {
      async.eachSeries(data, (region, nxtReg) => {
        regions.push({
          name: region.name,
          id: region.id,
          children: []
        })
        let children = []
        models.DistrictsModel.find({
          region: region._id
        }, (err, data) => {
          async.eachSeries(data, (district, nxtDistr) => {
            children.push({
              name: district.name,
              id: district._id,
              children: []
            })
            return nxtDistr()
          }, () => {
            regions[regions.length - 1].children = children
          })
        })
      })
    })
  })
})
module.exports = router
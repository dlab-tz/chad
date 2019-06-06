require('../init')
const formidable = require('formidable')
const winston = require('winston')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const async = require('async')
var express = require('express')
var router = express.Router()
const config = require('../config')
const mongo = require('../mongo')()
const models = require('../models')
const aggregator = require('../aggregator')
const mongoUser = config.getConf("DB_USER")
const mongoPasswd = config.getConf("DB_PASSWORD")
const mongoHost = config.getConf("DB_HOST")
const mongoPort = config.getConf("DB_PORT")
const database = config.getConf("DB_NAME")

router.post('/authenticate', (req, res) => {
  winston.error('authenticating')
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
              res.status(200).json({id: data._id})
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
          res.status(200).json({id: data._id})
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
          res.status(200).json({id: data._id})
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
          res.status(200).json({id: data._id})
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
          res.status(200).json({id: data._id})
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
          aggregator.createAccount(fields, () => {
            winston.info("CHA saved successfully")
            res.status(200).json({id: data._id})
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
      models.CHAModel.find({odkUsername: fields.username}, (err, data) => {
        winston.error(data)
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
          winston.info("HFS saved successfully")
          res.status(200).json({id: data._id})
        }
      })
    })
  })
})

router.get('/location/:type', (req, res) => {
  let model = req.params.type + 'Model'
  let id = req.query.id
  let query
  if(id) {
    query = {id: id}
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
      res.status(200).json(data)
    })
  })
})

router.get('/locationTree', (req, res) => {
  let id = req.query.id
  let type = req.query.type
  let lastLocationType = req.query.lastLocationType
  let checkChild = JSON.parse(req.query.checkChild)
  let model,childModel,typeTag
  if(!type) {
    model = "RegionsModel"
    childModel = "DistrictsModel"
    typeTag = "region"
  } else if(type === 'region') {
    model = 'DistrictsModel'
    childModel = "FacilitiesModel"
    typeTag = "district"
  } else if(type === 'district') {
    model = 'FacilitiesModel'
    childModel = "VillagesModel"
    typeTag = "facility"
  } else {
    model = 'VillagesModel'
    childModel = null
    typeTag = "village"
  }
  
  let query
  if(id) {
    query = {parent: id}
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
        if(childModel && checkChild) {
          models[childModel].find({'parent': dt.id}, (err, data2) => {
            if(data2.length > 0 && lastLocationType != typeTag) {
              data1[index].children = []
            }
            return nxtDt()
          })
        } else if(childModel) {
          if(lastLocationType != typeTag) {
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
        models.DistrictsModel.find({region: region._id}, (err, data) => {
          async.eachSeries(data, (district, nxtDistr) => {
            children.push({
              name: district.name,
              id: district._id,
              children: []
            })
            return nxtDistr()
          }, () => {
            regions[regions.length-1].children = children
          })
        })
      })
    })
  })
})
module.exports = router
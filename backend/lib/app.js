require('./init');
const express = require('express')
const winston = require('winston')
const async = require('async')
const Excel = require('exceljs')
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const formidable = require('formidable');
const aggregator = require('./aggregator')
const config = require('./config');
const models = require('./models');
const mongo = require('./mongo')();
const port = config.getConf('server:port')
const mongoUser = config.getConf("DB_USER")
const mongoPasswd = config.getConf("DB_PASSWORD")
const mongoHost = config.getConf("DB_HOST")
const mongoPort = config.getConf("DB_PORT")
const database = config.getConf("DB_NAME")
const app = express()

let jwtValidator = function (req, res, next) {
  if (req.method == "OPTIONS" ||
    req.path == "/authenticate/" ||
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

app.post('/authenticate', (req, res) => {
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

app.post('/addUser', (req, res) => {
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

app.post('/changePassword', (req, res) => {
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

app.get('/getRoles/:id?', (req, res) => {
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

app.get('/getUsers', (req, res) => {
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

app.all('/populateData', (req, res) => {
  let householdFormID = config.getConf("aggregator:householdForm:id")
  let householdFormName = config.getConf("aggregator:householdForm:name")
  winston.info("Received a request to update houses in XLSForm")
  aggregator.downloadXLSForm(householdFormID, householdFormName, (err) => {
    if(err) {
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
          let pregnant_wom_name, pregnant_wom_age,pregnant_wom_name_new, pregnant_wom_age_new
          if(keys.includes('pregnant_woman_name_new')) {
            pregnant_wom_name_new = data['pregnant_woman_name_new']
          } else {
            let preg_name_key = getKeys(keys, 'pregnant_woman_name_new')
            if (preg_name_key) {
              pregnant_wom_name_new = data[preg_name_key]
            }
          }
          if(keys.includes('pregnant_woman_name')) {
            pregnant_wom_name = data['pregnant_woman_name']
          } else {
            let preg_name_key = getKeys(keys, 'pregnant_woman_name')
            if (preg_name_key) {
              pregnant_wom_name = data[preg_name_key]
            }
          }
          if(keys.includes('pregnant_woman_age_new')) {
            pregnant_wom_age_new = data['pregnant_woman_age_new']
          } else {
            let preg_age_key = getKeys(keys, 'pregnant_woman_age_new')
            if (preg_age_key) {
              pregnant_wom_age_new = data[preg_age_key]
            }
          }
          if(data.house_name != 'add_new' && pregnant_wom_name != 'add_new') {
            return nxt()
          }
          let house_name = data.house_name_new
          let house_number = data.house_number_new
          if(data.house_name != 'add_new') {
            house_number = data.house_name.split('-').pop()
            house_name = data.house_name.split('-')[0]
          }
          let chadChoicesWorksheet = chadWorkbook.getWorksheet('choices')
          let add_preg_woman, add_house
          if(pregnant_wom_name == 'add_new') {
            add_preg_woman = true
          }
          if(data.house_name == 'add_new') {
            add_house = true
          }
          const chadPromises = []
          chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
            chadPromises.push(new Promise((resolve, reject) => {
              if(!chadRows.values.includes('house_name') && !chadRows.values.includes('pregnant_women')) {
                return resolve()
              }
              if(chadRows.values.includes('house_name') && chadRows.values.includes(house_name + ' - ' + house_number)) {
                add_house = false
              }
              let preg_wom_label = pregnant_wom_name_new + ' - ' + pregnant_wom_age_new + ' - ' + house_number
              if(chadRows.values.includes('pregnant_women') && chadRows.values.includes(preg_wom_label)) {
                add_preg_woman = false
              }
              return resolve()
            }))
          })
          Promise.all(chadPromises).then(() => {
            async.series({
              house: (callback) => {
                if(add_house) {
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
                if(add_preg_woman) {
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

app.post('/addRegion', (req, res) => {

})

app.listen(port, () => {
  winston.info("Server is running and listening on port " + port)
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
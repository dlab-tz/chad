require('./init');
require('./clone');
require('./connection');
const express = require('express');
const winston = require('winston');
const async = require('async');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const xml2js = require('xml2js');
const urlParser = require('url');
const fs = require('fs');
const formidable = require('formidable');
var guiRouter = require('./routes/gui');
const aggregator = require('./aggregator');
const mixin = require('./mixin');
const rapidpro = require('./rapidpro');
const config = require('./config');
const models = require('./models');
const mongo = require('./mongo')(rapidpro);
const port = config.getConf('server:port');

const app = express();

let jwtValidator = function (req, res, next) {
  if (
    req.method == 'OPTIONS' ||
    req.path == '/authenticate/' ||
    req.path == '/syncLocations' ||
    req.path.includes(config.getConf('aggregator:account')) ||
    req.path == '/newSubmission' ||
    req.path == '/clinicReminder' ||
    req.path == '/updateReferalStatus' ||
    req.path == '/' ||
    req.path.startsWith('/static/js') ||
    req.path.startsWith('/static/css') ||
    req.path.startsWith('/static/img')
  ) {
    return next();
  }
  if (
    !req.headers.authorization ||
    req.headers.authorization.split(' ').length !== 2
  ) {
    winston.error('Token is missing');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('WWW-Authenticate', 'Bearer realm="Token is required"');
    res.set('charset', 'utf - 8');
    res.status(401).json({
      error: 'Token is missing',
    });
  } else {
    tokenArray = req.headers.authorization.split(' ');
    let token = (req.headers.authorization = tokenArray[1]);
    jwt.verify(token, config.getConf('auth:secret'), (err, decoded) => {
      if (err) {
        winston.warn('Token expired');
        res.set('Access-Control-Allow-Origin', '*');
        res.set('WWW-Authenticate', 'Bearer realm="Token expired"');
        res.set('charset', 'utf - 8');
        res.status(401).json({
          error: 'Token expired',
        });
      } else {
        // winston.info("token is valid")
        if (req.path == '/isTokenActive/') {
          res.set('Access-Control-Allow-Origin', '*');
          res.status(200).send(true);
        } else {
          return next();
        }
      }
    });
  }
};
app.use(jwtValidator);
app.use(express.static(__dirname + '/../gui'));
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());
app.use('/', guiRouter);

app.get('/:aggregatorAccount/formList', (req, res) => {
  winston.info('Received a request to get forms');
  aggregator.formList(req.params.aggregatorAccount, (err, response, body) => {
    let parseString = xml2js.parseString;
    parseString(body, (err, bodyJSON) => {
      winston.info('Sending back response');
      for (let xform in bodyJSON.xforms.xform) {
        let url = urlParser.parse(bodyJSON.xforms.xform[xform].downloadUrl[0]);
        bodyJSON.xforms.xform[xform].downloadUrl[0] =
          url.protocol +
          '//' +
          req.hostname +
          ':' +
          config.getConf('server:port') +
          url.pathname;
      }
      let builder = new xml2js.Builder();
      let bodyXML = builder.buildObject(bodyJSON);
      res.set(response.headers);
      res.status(response.statusCode).send(bodyXML);
    });
  });
});

app.get('/:aggregatorAccount/forms/:id/form.xml', (req, res) => {
  winston.info(
    'Received a request to download form with id ' +
    req.params.id +
    ' from account ' +
    req.params.aggregatorAccount
  );
  aggregator.forms(
    req.params.aggregatorAccount,
    req.params.id,
    req,
    (err, response, body) => {
      winston.info('Sending data for form with id ' + req.params.id);
      res.set(response.headers);
      res.status(response.statusCode).send(body);
    }
  );
});

app.post('/:aggregatorAccount/submission', (req, res) => {
  winston.info('Received new submission');
  const parseString = xml2js.parseString;
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    const fileName = Object.keys(files)[0];
    fs.readFile(files[fileName].path, (err, fileData) => {
      parseString(
        fileData, {
          explicitArray: false,
          mergeAttrs: true,
        },
        function (err, result) {
          let houseHoldFormName = config.getConf(
            'aggregator:householdForm:name'
          );
          if (!result[houseHoldFormName]) {
            aggregator.submitToAggregator(
              req,
              files[fileName].path,
              (err, response, body) => {
                res.set(response.headers);
                res.status(response.statusCode).send(body);
              }
            );
          } else {
            mongo.generateSubmissionSchema(schemaFields => {
              mixin.convertSubmissionToSchemaFormat(
                result,
                schemaFields,
                () => {
                  mixin.flattenSubmission(result, submission => {
                    aggregator.newSubmission(
                      submission,
                      (err, response, body) => {
                        if (
                          err ||
                          (response.statusCode &&
                            (response.statusCode < 200 ||
                              response.statusCode > 299))
                        ) {
                          res.status(500).send();
                        } else {
                          res.status(201).send();
                        }
                      }
                    );
                  });
                }
              );
            });
          }
        }
      );
    });
  });
});

app.post('/newSubmission', (req, res) => {});

app.get('/updateReferalStatus', (req, res) => {
  let referal = req.query.referal_update;
  let status = req.query.status;
  let HFSphone = req.query.phone.toString();
  if (HFSphone[0] != '+') {
    HFSphone = '+' + HFSphone.toString();
    HFSphone = HFSphone.replace(/\s/g, '');
  }
  referal = referal.replace(/update/ig, '');
  if (status == 'admitted') {
    referal = referal.replace(/admitted/ig, '');
    referal = referal.replace(/admited/ig, '');
    referal = referal.replace(/adm/ig, '');
  } else if (status == 'discharged') {
    referal = referal.replace(/discharged/ig, '');
    referal = referal.replace(/discharge/ig, '');
    referal = referal.replace(/disch/ig, '');
  } else if (status == 'treated') {
    referal = referal.replace(/treated/ig, '');
    referal = referal.replace(/treted/ig, '');
  } else if (status == 'not_received') {
    referal = referal.replace(/not received/ig, '');
    referal = referal.replace(/not receved/ig, '');
    referal = referal.replace(/not recieved/ig, '');
    referal = referal.replace(/not recived/ig, '');
  }
  referalID = referal.replace(/\s/g, '');
  winston.info('Updatating referal ' + referalID);
  if (!referalID) {
    let sms = `Please include referal ID in your sms`;
    let phone = ['tel:' + HFSphone];
    rapidpro.broadcast({
      tels: phone,
      sms,
    });
    return;
  }
  res.status(200).send();
  mongo.updateReferal(referalID, status, HFSphone, () => {
    winston.error('done');
  });
});

app.all('/clinicReminder', (req, res) => {
  rapidpro.clinicReminder(err => {
    if (err) {
      res.status(500).send();
    } else {
      res.status(200).send();
    }
  });
});

app.get('/syncLocations', (req, res) => {
  async.series({
    regions: callback => {
      mongo.getRegions('', (err, data) => {
        if (data) {
          data = JSON.parse(JSON.stringify(data));
          async.eachSeries(
            data,
            (dt, nxtDt) => {
              aggregator.addLocationToXLSForm(
                dt._id,
                dt.name,
                '',
                'regions',
                () => {
                  return nxtDt();
                }
              );
            },
            () => {
              return callback(false);
            }
          );
        } else {
          return callback(false);
        }
      });
    },
    districts: callback => {
      mongo.getDistricts('', (err, data) => {
        if (data) {
          data = JSON.parse(JSON.stringify(data));
          async.eachSeries(
            data,
            (dt, nxtDt) => {
              aggregator.addLocationToXLSForm(
                dt._id,
                dt.name,
                dt.parent._id,
                'districts',
                () => {
                  return nxtDt();
                }
              );
            },
            () => {
              return callback(false);
            }
          );
        } else {
          return callback(false);
        }
      });
    },
    villages: callback => {
      mongo.getVillages('', (err, data) => {
        if (data) {
          data = JSON.parse(JSON.stringify(data));
          async.eachSeries(
            data,
            (dt, nxtDt) => {
              aggregator.addLocationToXLSForm(
                dt._id,
                dt.name,
                dt.parent.parent,
                'villages',
                () => {
                  return nxtDt();
                }
              );
            },
            () => {
              return callback(false);
            }
          );
        } else {
          return callback(false);
        }
      });
    },
  });
});

app.get('/syncContacts', (req, res) => {
  async.parallel({
      chaSync: callback => {
        mongo.getCHA(null, (err, data) => {
          async.each(
            data,
            (cha, nxtCha) => {
              let urns = ['tel:+255' + cha.phone1.substring(1)];
              if (cha.phone2 && cha.phone.length == 10) {
                urns.push('tel:+255' + cha.phone2.substring(1));
              }
              let contact = {
                name: cha.firstName + ' ' + cha.otherName + ' ' + cha.surname,
                urns: urns,
                fields: {
                  chadid: cha._id,
                  category: 'CHA',
                  village: cha.village._id,
                },
              };
              rapidpro.addContact(contact, (err, newContact) => {
                if (!err) {
                  mongo.updateCHARapidproId(
                    newContact.fields.chadid,
                    newContact.uuid,
                    () => {
                      return nxtCha();
                    }
                  );
                } else {
                  return nxtCha();
                }
              });
            },
            () => {
              return callback(null, null);
            }
          );
        });
      },
      hfsSync: callback => {
        mongo.getHFS(null, (err, data) => {
          async.each(
            data,
            (cha, nxtHfs) => {
              let urns = ['tel:+255' + cha.phone1.substring(1)];
              if (cha.phone2 && cha.phone2.length == 10) {
                urns.push('tel:+255' + cha.phone2.substring(1));
              }
              let contact = {
                name: cha.firstName + ' ' + cha.otherName + ' ' + cha.surname,
                urns: urns,
                fields: {
                  chadid: cha._id,
                  category: 'HFS',
                  facility: cha.facility._id,
                },
              };
              rapidpro.addContact(contact, (err, newContact) => {
                if (!err) {
                  mongo.updateHFSRapidproId(
                    newContact.fields.chadid,
                    newContact.uuid,
                    () => {
                      return nxtHfs();
                    }
                  );
                } else {
                  return nxtHfs();
                }
              });
            },
            () => {
              return callback(null, null);
            }
          );
        });
      },
    },
    () => {
      winston.info('Contacts sync is done');
    }
  );
});

app.listen(port, () => {
  winston.info('Server is running and listening on port ' + port);
  let db = mongoose.connection;
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('open', () => {
    models.UsersModel.find({
        userName: 'root@bmf.org',
      })
      .lean()
      .exec((err, data) => {
        if (data.length == 0) {
          winston.info('Default user not found, adding now ...');
          let roles = [{
              name: 'Admin',
            },
            {
              name: 'Data Manager',
            },
          ];
          models.RolesModel.collection.insertMany(roles, (err, data) => {
            models.RolesModel.find({
                name: 'Admin',
              },
              (err, data) => {
                let User = new models.UsersModel({
                  firstName: 'Root',
                  surname: 'Root',
                  userName: 'root@bmf.org',
                  status: 'Active',
                  role: data[0]._id,
                  password: bcrypt.hashSync('chad', 8),
                });
                User.save((err, data) => {
                  if (err) {
                    winston.error(err);
                    winston.error('Unexpected error occured,please retry');
                  } else {
                    winston.info('Admin User added successfully');
                  }
                });
              }
            );
          });
        }
      });
  });
});
require('./init')

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
    getHFS(id, callback) {
      let query = {}
      if(id) {
        query = {id}
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
    }
  }
}

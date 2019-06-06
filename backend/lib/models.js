const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let Users = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  otherName: {
    type: String
  },
  surname: {
    type: String,
    required: true
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: 'Roles',
    required: true
  },
  userName: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true
  },
  lastModified: {
    type: Date
  }
})
let Roles = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  }
})
let Regions = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  }
})
let Districts = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'Regions',
    required: true
  }
})
let Facilities = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'Districts',
    required: true
  }
})
let Villages = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'Facilities',
    required: true
  }
})
let HFS = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  otherName: {
    type: String
  },
  surname: {
    type: String,
    required: true,
    unique: true
  },
  phone1: {
    type: String,
    required: true
  },
  phone2: {
    type: String
  },
  email: {
    type: String
  },
  facility: {
    type: Schema.Types.ObjectId,
    ref: 'Facilities',
    required: true
  },
  rapidproId: {
    type: String
  }
})
let CHA = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  otherName: {
    type: String
  },
  surname: {
    type: String,
    required: true
  },
  odkUsername: {
    type: String,
    required: true,
    unique: true
  },
  phone1: {
    type: String,
    required: true
  },
  phone2: {
    type: String
  },
  email: {
    type: String
  },
  village: {
    type: Schema.Types.ObjectId,
    ref: 'Villages',
    required: true
  },
  rapidproId: {
    type: String
  }
})

let RegionsModel = mongoose.model('Regions', Regions)
let DistrictsModel = mongoose.model('Districts', Districts)
let FacilitiesModel = mongoose.model('Facilities', Facilities)
let VillagesModel = mongoose.model('Villages', Villages)
let HFSModel = mongoose.model('HFS', HFS)
let CHAModel = mongoose.model('CHA', CHA)
let RolesModel = mongoose.model('Roles', Roles)
let UsersModel = mongoose.model('Users', Users)
module.exports = {
  RegionsModel,
  DistrictsModel,
  FacilitiesModel,
  VillagesModel,
  HFSModel,
  CHAModel,
  UsersModel,
  RolesModel
}
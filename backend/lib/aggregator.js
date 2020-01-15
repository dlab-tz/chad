require('./init');
const request = require('request');
const winston = require('winston');
const uuid4 = require('uuid/v4');
const config = require('./config');
const mixin = require('./mixin');
const URI = require('urijs');
const fs = require('fs');
const shortid = require('shortid');
const async = require('async');

const rapidpro = require('./rapidpro');
const mongo = require('./mongo')(rapidpro);

const formList = (account, callback) => {
  let host = config.getConf('aggregator:host');
  let url = URI(host)
    .segment(account)
    .segment('formList')
    .toString();
  let options = {
    url: url,
  };
  request.get(options, (err, res, body) => {
    if (err) {
      winston.error(err);
    }
    return callback(err, res, body);
  });
};

const forms = (account, id, req, callback) => {
  let host = config.getConf('aggregator:host');
  let url = URI(host)
    .segment(account)
    .segment('forms')
    .segment(id)
    .segment('form.xml')
    .toString();
  let options = {
    url: url,
    headers: req.headers,
  };
  request.get(options, (err, res, body) => {
    if (err) {
      winston.error(err);
    }
    return callback(err, res, body);
  });
};

const submitToAggregator = (req, file, callback) => {
  let host = config.getConf('aggregator:host');
  let token = config.getConf('aggregator:token');
  let url = URI(host)
    .segment('api')
    .segment('v1')
    .segment('submissions')
    //.addQuery('deviceID', req.query.deviceID)
    .toString();
  let options = {
    url: url,
    headers: {
      Authorization: `Token ${token}`,
    },
    formData: {
      xml_submission_file: fs.createReadStream(file),
    },
  };

  request.post(options, (err, res, body) => {
    if (err) {
      winston.error(err);
    }
    return callback(err, res, body);
  });
};

const publishForm = (formId, formName, callback) => {
  let token = config.getConf('aggregator:token');
  let host = config.getConf('aggregator:host');
  let url = new URI(host)
    .segment('/api/v1/forms')
    .segment(formId)
    .toString();
  let options = {
    url: url,
    headers: {
      Authorization: `Token ${token}`,
    },
    formData: {
      xls_file: fs.createReadStream(__dirname + '/' + formName + '.xlsx'),
    },
  };
  request.patch(options, (err, res, body) => {
    if (err) {
      winston.error(err, res, body);
    }
    return callback(err, res, body);
  });
};

const addLocationToXLSForm = (id, name, parent, type, callback) => {
  let householdFormID = config.getConf('aggregator:householdForm:id');
  let householdFormName = uuid4();
  downloadXLSForm(householdFormID, householdFormName, err => {
    mixin.getWorkbook(
      __dirname + '/' + householdFormName + '.xlsx',
      chadWorkbook => {
        let chadChoicesWorksheet = chadWorkbook.getWorksheet('choices');
        let lastRow = chadChoicesWorksheet.lastRow;
        let getRowInsert = chadChoicesWorksheet.getRow(++lastRow.number);
        if (!parent) {
          parent = '';
        }
        getRowInsert.getCell(1).value = type;
        getRowInsert.getCell(2).value = id;
        getRowInsert.getCell(3).value = name;
        getRowInsert.getCell(4).value = name;
        getRowInsert.getCell(5).value = parent;
        getRowInsert.commit();
        winston.info('writting new house into local household_visit XLSForm');
        chadWorkbook.xlsx
          .writeFile(__dirname + '/' + householdFormName + '.xlsx')
          .then(() => {
            winston.info(
              'Updating the online CHAD XLSForm with the local household XLSForm'
            );
            publishForm(
              householdFormID,
              householdFormName,
              (err, res, body) => {
                fs.unlink(
                  __dirname + '/' + householdFormName + '.xlsx',
                  () => {}
                );
                winston.info('Online household XLSForm Updated');
                return callback(err, res, body);
              }
            );
          });
      }
    );
  });
};

const downloadXLSForm = (formId, formName, callback) => {
  winston.info('Getting online XLSForm in XLS format...');
  let token = config.getConf('aggregator:token');
  let host = config.getConf('aggregator:host');
  let url = new URI(host)
    .segment('/api/v1/forms/' + formId + '/form.xls')
    .toString();
  let options = {
    url: url,
    headers: {
      Authorization: `Token ${token}`,
    },
  };
  let status = request
    .get(options)
    .on('error', err => {
      winston.error(err);
      winston.error('An error occured while downloading XLSForm');
      return callback(err);
    })
    .pipe(fs.createWriteStream(__dirname + '/' + formName + '.xlsx'));

  status.on('finish', () => {
    winston.info('Finished downloading XLSForm in XLS Format');
    return callback(false);
  });
};

const downloadJSONForm = (formId, callback) => {
  winston.info('Getting online XLSForm in JSON formathhh');
  let username = config.getConf('aggregator:user');
  let password = config.getConf('aggregator:password');
  let host = config.getConf('aggregator:host');
  let auth =
    'Basic ' + new Buffer(username + ':' + password).toString('base64');
  let url = new URI(host)
    .segment('/api/v1/forms')
    .segment(formId)
    .segment('form.json')
    .toString();
  let options = {
    url: url,
    headers: {
      Authorization: auth,
    },
  };
  request.get(options, (err, res, body) => {
    winston.info('Finished downloading XLSForm in JSON Format');
    if (err) {
      winston.error(err, res, body);
    }
    return callback(err, res, body);
  });
};

const downloadFormData = (formId, callback) => {
  let username = config.getConf('aggregator:user');
  let password = config.getConf('aggregator:password');
  let host = config.getConf('aggregator:host');
  let auth =
    'Basic ' + new Buffer(username + ':' + password).toString('base64');
  let url = new URI(host)
    .segment('/api/v1/data')
    .segment(formId)
    .toString();
  let options = {
    url: url,
    headers: {
      Authorization: auth,
    },
  };
  winston.info('fetching data from aggregator');
  request.get(options, (err, res, formData) => {
    if (err) {
      winston.error(err, res, body);
    }
    return callback(err, res, formData);
  });
};

const populateHouses = (
  chadChoicesWorksheet,
  house_name,
  house_number,
  village,
  callback
) => {
  let lastRow = chadChoicesWorksheet.lastRow;
  let getRowInsert = chadChoicesWorksheet.getRow(++lastRow.number);
  getRowInsert.getCell(1).value = 'house_name';
  getRowInsert.getCell(2).value = house_number;
  getRowInsert.getCell(3).value = house_name + ' - ' + house_number;
  getRowInsert.getCell(4).value = house_name + ' - ' + house_number;
  getRowInsert.getCell(5).value = village;
  getRowInsert.commit();
  return callback(false);
};

const populatePregnantWomen = (
  chadChoicesWorksheet,
  pregnant_wom_name,
  pregnant_wom_age,
  house_number,
  callback
) => {
  let lastRow = chadChoicesWorksheet.lastRow;
  let getRowInsert = chadChoicesWorksheet.getRow(++lastRow.number);
  getRowInsert.getCell(1).value = 'pregnant_women';
  getRowInsert.getCell(2).value =
    pregnant_wom_name + ' - ' + pregnant_wom_age + ' - ' + house_number;
  getRowInsert.getCell(3).value =
    pregnant_wom_name + ' - ' + pregnant_wom_age + ' - ' + house_number;
  getRowInsert.getCell(4).value =
    pregnant_wom_name + ' - ' + pregnant_wom_age + ' - ' + house_number;
  getRowInsert.getCell(5).value = house_number;
  getRowInsert.commit();
  return callback(false);
};

const createAccount = (details, callback) => {
  let formId = config.getConf('aggregator:householdForm:id');
  let profile = {
    username: details.odkUsername,
    password: details.surname,
    first_name: details.firstName,
    last_name: details.surname,
    email: details.email,
  };
  let token = config.getConf('aggregator:token');
  let host = config.getConf('aggregator:host');
  let url = new URI(host).segment('/api/v1/profiles').toString();
  let options = {
    url: url,
    headers: {
      Authorization: `Token ${token}`,
    },
    body: profile,
    json: true,
  };
  request.post(options, (err, res, body) => {
    if (err) {
      winston.error(err, res, body);
    }
    shareFormWithUser(formId, details.odkUsername, () => {
      return callback(err, res, body);
    });
  });
};

const shareFormWithUser = (formId, username, callback) => {
  let token = config.getConf('aggregator:token');
  let host = config.getConf('aggregator:host');
  let url = new URI(host).segment(`/api/v1/forms/${formId}/share`).toString();
  let options = {
    url: url,
    headers: {
      Authorization: `Token ${token}`,
    },
    body: {
      username: username,
      role: 'dataentry',
    },
    json: true,
  };
  request.post(options, (err, res, body) => {
    if (err) {
      winston.error(err, res, body);
    }
    return callback(err, res, body);
  });
};

const newSubmission = (submission, callback) => {
  //acknowlodge recipient
  // res.status(200).send();
  // winston.info('New submission received');
  let householdFormID = config.getConf('aggregator:householdForm:id');
  let householdFormName = uuid4();
  // let submission = req.body;
  // populate any new house/ pregnant woman as a choice
  downloadXLSForm(householdFormID, householdFormName, err => {
    mixin.getWorkbook(
      __dirname + '/' + householdFormName + '.xlsx',
      chadWorkbook => {
        let chadChoicesWorksheet = chadWorkbook.getWorksheet('choices');
        let [house_name] = mixin.getDataFromJSON(submission, 'house_name');
        async.series(
          {
            new_house: callback => {
              if (house_name == 'add_new') {
                let [new_house_name] = mixin.getDataFromJSON(
                  submission,
                  'house_name_new'
                );
                let [new_house_number] = mixin.getDataFromJSON(
                  submission,
                  'house_number_new'
                );
                let [village] = mixin.getDataFromJSON(submission, 'village');
                populateHouses(
                  chadChoicesWorksheet,
                  new_house_name,
                  new_house_number,
                  village,
                  err => {
                    winston.info(
                      'writting new house into local household_visit XLSForm'
                    );
                    chadWorkbook.xlsx
                      .writeFile(__dirname + '/' + householdFormName + '.xlsx')
                      .then(() => {
                        return callback(false, false);
                      });
                  }
                );
              } else {
                return callback(false, false);
              }
            },
            new_preg_wom: callback => {
              async.each(
                submission.rp_preg_woman,
                (preg_wom, nxtPregWom) => {
                  let [pregnant_woman_name] = mixin.getDataFromJSON(
                    preg_wom,
                    'pregnant_woman_name'
                  );
                  if (pregnant_woman_name == 'add_new') {
                    let [new_preg_woman_name] = mixin.getDataFromJSON(
                      preg_wom,
                      'pregnant_woman_name_new'
                    );
                    let [new_pregnant_woman_age] = mixin.getDataFromJSON(
                      preg_wom,
                      'pregnant_woman_age_new'
                    );
                    let [house_number] = mixin.getDataFromJSON(
                      submission,
                      'house_number_new'
                    );
                    if (!house_number) {
                      [house_number] = mixin.getDataFromJSON(
                        submission,
                        'house_number'
                      );
                    }
                    populatePregnantWomen(
                      chadChoicesWorksheet,
                      new_preg_woman_name,
                      new_pregnant_woman_age,
                      house_number,
                      err => {
                        winston.info(
                          'writting new pregnant woman into local household_visit XLSForm'
                        );
                        chadWorkbook.xlsx
                          .writeFile(
                            __dirname + '/' + householdFormName + '.xlsx'
                          )
                          .then(() => {
                            return nxtPregWom();
                          });
                      }
                    );
                  } else {
                    return nxtPregWom();
                  }
                },
                () => {
                  return callback(false, false);
                }
              );
            },
          },
          () => {
            winston.info(
              'Updating the online CHAD XLSForm with the local household XLSForm'
            );
            publishForm(
              householdFormID,
              householdFormName,
              (err, res, body) => {
                fs.unlink(
                  __dirname + '/' + householdFormName + '.xlsx',
                  () => {}
                );
                winston.info('Online household XLSForm Updated');
                return callback(err, res, body);
              }
            );
          }
        );

        let submissionKeys = Object.keys(submission);
        let submissionTopLevelKeys = submissionKeys.map(key => {
          return key.split('/').pop();
        });

        let [danger_signs_emergency] = mixin.getDataFromJSON(
          submission,
          'danger_signs_emergency'
        );
        // check emergency visit referal
        if (danger_signs_emergency) {
          let referalID = shortid.generate();
          submission.referalID = referalID;
          submission.referalStatus = 'pending';
          let sms = `ID: ${referalID} \\n Issues:`;
          let issues = '';
          danger_signs_emergency = danger_signs_emergency.split(' ');
          async.eachSeries(
            danger_signs_emergency,
            (danger_sign, nxtDangerSign) => {
              if (danger_sign === 'others') {
                if (issues) {
                  issues += ', ';
                }
                let [em_issues] = mixin.getDataFromJSON(
                  submission,
                  'danger_signs_emergency_others'
                );
                issues += em_issues;
                return nxtDangerSign();
              }
              const promises = [];
              chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
                promises.push(
                  new Promise((resolve, reject) => {
                    if (
                      chadRows.values.includes('danger_signs_emergency') &&
                      chadRows.values.includes(danger_sign)
                    ) {
                      if (issues) {
                        issues += ', ';
                      }
                      issues += chadRows.values[chadRows.values.length - 1];
                      resolve();
                    } else {
                      resolve();
                    }
                  })
                );
              });
              Promise.all(promises).then(() => {
                return nxtDangerSign();
              });
            },
            () => {
              sms += issues;
              rapidpro.alertReferal(submission.username, sms);
            }
          );
        }

        // check if needs referal
        // check pregnant woman referral
        let [rp_preg_woman, rp_preg_woman_full_key] = mixin.getDataFromJSON(
          submission,
          'rp_preg_woman'
        );
        if (Array.isArray(rp_preg_woman) && rp_preg_woman.length > 0) {
          async.eachOf(rp_preg_woman, (preg_wom, preg_wom_ind, nxtPregWom) => {
            // Schedule a reminder for clinic
            let [house_number] = mixin.getDataFromJSON(
              submission,
              'house_name'
            );
            if (house_number == 'add_new') {
              [house_number] = mixin.getDataFromJSON(
                submission,
                'house_number_new'
              );
            }
            [last_clin_vis] = mixin.getDataFromJSON(
              preg_wom,
              'forth_visit_above'
            );
            if (!last_clin_vis) {
              [last_clin_vis] = mixin.getDataFromJSON(preg_wom, 'third_visit');
              if (!last_clin_vis) {
                [last_clin_vis] = mixin.getDataFromJSON(
                  preg_wom,
                  'second_visit'
                );
                if (!last_clin_vis) {
                  [last_clin_vis] = mixin.getDataFromJSON(
                    preg_wom,
                    'first_visit'
                  );
                }
              }
            }
            let [last_menstrual] = mixin.getDataFromJSON(
              preg_wom,
              'last_menstrual_period'
            );
            let [preg_wom_name] = mixin.getDataFromJSON(
              preg_wom,
              'pregnant_woman_name'
            );
            let preg_wom_age;
            if (preg_wom_name === 'add_new') {
              [preg_wom_name] = mixin.getDataFromJSON(
                preg_wom,
                'pregnant_woman_name_new'
              );
              let preg_wom_age_dt = mixin.getDataFromJSON(
                preg_wom,
                'pregnant_woman_age_new'
              );
              preg_wom_age = preg_wom_age_dt[0];
              mongo.addPregnantWoman(
                house_number,
                preg_wom_name,
                preg_wom_age,
                last_clin_vis,
                last_menstrual,
                submission.username
              );
            } else if (preg_wom_name !== 'add_new') {
              let preg_wom_name_arr = preg_wom_name.split('-');
              preg_wom_name = preg_wom_name_arr.shift().trim();
              preg_wom_age = preg_wom_name_arr.shift().trim();
              mongo.updatePregnantWoman(
                house_number,
                preg_wom_name,
                preg_wom_age,
                last_clin_vis,
                last_menstrual,
                submission.username
              );
            }
            // end of scheduling a reminder for clinic

            let [danger_signs] = mixin.getDataFromJSON(
              preg_wom,
              'danger_signs'
            );
            if (danger_signs) {
              let referalID = shortid.generate();
              submission[rp_preg_woman_full_key][
                preg_wom_ind
              ].referalID = referalID;
              submission[rp_preg_woman_full_key][preg_wom_ind].referalStatus =
                'pending';
              let sms = `ID: ${referalID} \\n Patient: ${preg_wom_name}, Age: ${preg_wom_age} \\n Pregnant Woman \\n Issues: `;
              let issues = '';
              danger_signs = danger_signs.split(' ');
              async.eachSeries(
                danger_signs,
                (danger_sign, nxtDangerSign) => {
                  const promises = [];
                  chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
                    promises.push(
                      new Promise((resolve, reject) => {
                        if (
                          chadRows.values.includes('danger_signs') &&
                          chadRows.values.includes(danger_sign)
                        ) {
                          if (issues) {
                            issues += ', ';
                          }
                          issues += chadRows.values[chadRows.values.length - 1];
                          resolve();
                        } else {
                          resolve();
                        }
                      })
                    );
                  });
                  Promise.all(promises).then(() => {
                    return nxtDangerSign();
                  });
                },
                () => {
                  sms += issues;
                  rapidpro.alertReferal(submission.username, sms);
                  return nxtPregWom();
                }
              );
            } else {
              return nxtPregWom();
            }
          });
        }

        // check postnatal mother referral
        let [
          rp_breast_feed_mother,
          rp_breast_feed_mother_full_key,
        ] = mixin.getDataFromJSON(submission, 'rp_breast_feed_mother');
        if (
          Array.isArray(rp_breast_feed_mother) &&
          rp_breast_feed_mother.length > 0
        ) {
          async.eachOf(
            rp_breast_feed_mother,
            (postnatal_mthr, postnatal_mthr_ind, nxtPostnatalMthr) => {
              let [psigns] = mixin.getDataFromJSON(
                postnatal_mthr,
                'puperium_danger_signs'
              );
              let signs = [];
              if (psigns) {
                signs = psigns.split(' ');
              }
              if (signs.length > 0) {
                let referalID = shortid.generate();
                submission[rp_breast_feed_mother_full_key][
                  postnatal_mthr_ind
                ].referalID = referalID;
                submission[rp_breast_feed_mother_full_key][
                  postnatal_mthr_ind
                ].referalStatus = 'pending';
                let sms = `ID: ${referalID} \\n Patient:Postnatal mother \\n Issues:`;
                let issues = '';
                async.eachSeries(
                  signs,
                  (sign, nxtDangerSign) => {
                    const promises = [];
                    chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
                      promises.push(
                        new Promise((resolve, reject) => {
                          if (
                            chadRows.values.includes('puperium_danger_signs') &&
                            chadRows.values.includes(sign)
                          ) {
                            if (issues) {
                              issues += ', ';
                            }
                            issues +=
                              chadRows.values[chadRows.values.length - 1];
                            resolve();
                          } else {
                            resolve();
                          }
                        })
                      );
                    });
                    Promise.all(promises).then(() => {
                      return nxtDangerSign();
                    });
                  },
                  () => {
                    sms += issues;
                    rapidpro.alertReferal(submission.username, sms);
                    return nxtPostnatalMthr();
                  }
                );
              } else {
                return nxtPostnatalMthr();
              }
            }
          );
        }

        // check neonatal child referral
        if (
          Array.isArray(rp_breast_feed_mother) &&
          rp_breast_feed_mother.length > 0
        ) {
          async.eachOf(
            rp_breast_feed_mother,
            (postnatal_mthr, postnatal_mthr_ind, nxtNeonatalChild) => {
              let [neo_babies, neo_babies_full_key] = mixin.getDataFromJSON(
                postnatal_mthr,
                'rp_neonatal_baby'
              );
              async.eachOf(
                neo_babies,
                (neo_baby, neo_baby_ind, nxtNeoBaby) => {
                  let [nsigns] = mixin.getDataFromJSON(
                    neo_baby,
                    'neonatal_danger_sign'
                  );
                  let signs = [];
                  if (nsigns) {
                    signs = nsigns.split(' ');
                  }

                  if (signs.length > 0) {
                    let referalID = shortid.generate();
                    submission[rp_breast_feed_mother_full_key][
                      postnatal_mthr_ind
                    ][neo_babies_full_key][neo_baby_ind].referalID = referalID;
                    submission[rp_breast_feed_mother_full_key][
                      postnatal_mthr_ind
                    ][neo_babies_full_key][neo_baby_ind].referalStatus =
                      'pending';
                    let sms = `ID: ${referalID} \\n Patient:Neonatal baby \\n Issues:`;
                    let issues = '';
                    async.eachSeries(
                      signs,
                      (sign, nxtDangerSign) => {
                        const promises = [];
                        chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
                          promises.push(
                            new Promise((resolve, reject) => {
                              if (
                                chadRows.values.includes(
                                  'neonatal_danger_sign'
                                ) &&
                                chadRows.values.includes(sign)
                              ) {
                                if (issues) {
                                  issues += ', ';
                                }
                                issues +=
                                  chadRows.values[chadRows.values.length - 1];
                                resolve();
                              } else {
                                resolve();
                              }
                            })
                          );
                        });
                        Promise.all(promises).then(() => {
                          return nxtDangerSign();
                        });
                      },
                      () => {
                        sms += issues;
                        rapidpro.alertReferal(submission.username, sms);
                        return nxtNeoBaby();
                      }
                    );
                  } else {
                    return nxtNeoBaby();
                  }
                },
                () => {
                  return nxtNeonatalChild();
                }
              );
            }
          );
        }

        // check children under 5 referral
        let [under_5, under_5_full_key] = mixin.getDataFromJSON(
          submission,
          'rp_children_under_5'
        );
        if (under_5 && under_5.length > 0) {
          async.eachOf(under_5, (susp_pat, susp_pat_ind, nxtSuspPat) => {
            let [danger_signs] = mixin.getDataFromJSON(
              susp_pat,
              'danger_signs_child'
            );
            if (danger_signs) {
              let referalID = shortid.generate();
              submission[under_5_full_key][susp_pat_ind].referalID = referalID;
              submission[under_5_full_key][susp_pat_ind].referalStatus =
                'pending';
              let [age] = mixin.getDataFromJSON(susp_pat, 'child_age');
              let sms = `ID: ${referalID} \\n `;
              if (age) {
                sms += `Age: ${age} \\n`;
              }
              sms += `Patient: Children under 5 \\n Issues: `;
              let issues = '';
              danger_signs = danger_signs.split(' ');
              async.eachSeries(
                danger_signs,
                (danger_sign, nxtDangerSign) => {
                  const promises = [];
                  chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
                    promises.push(
                      new Promise((resolve, reject) => {
                        if (
                          chadRows.values.includes('danger_signs_child') &&
                          chadRows.values.includes(danger_sign)
                        ) {
                          if (issues) {
                            issues += ', ';
                          }
                          issues += chadRows.values[chadRows.values.length - 1];
                          resolve();
                        } else {
                          resolve();
                        }
                      })
                    );
                  });
                  Promise.all(promises).then(() => {
                    return nxtDangerSign();
                  });
                },
                () => {
                  sms += issues;
                  rapidpro.alertReferal(submission.username, sms);
                  return nxtSuspPat();
                }
              );
            } else {
              return nxtSuspPat();
            }
          });
        }

        // check  any other sick person referral
        let [sick_person, sick_person_full_key] = mixin.getDataFromJSON(
          submission,
          'rp_sick_person'
        );
        if (sick_person && sick_person.length > 0) {
          async.eachOf(sick_person, (susp_pat, susp_pat_ind, nxtSuspPat) => {
            let danger_signs = mixin.getDataFromJSON(
              susp_pat,
              'general_examination'
            );
            let [age] = mixin.getDataFromJSON(susp_pat, 'sick_person_age');
            if (danger_signs) {
              let referalID = shortid.generate();
              submission[sick_person_full_key][
                susp_pat_ind
              ].referalID = referalID;
              submission[sick_person_full_key][susp_pat_ind].referalStatus =
                'pending';
              let sms = `ID: ${referalID} \\n `;
              if (age) {
                sms += `Age: ${age} \\n`;
              }
              sms += 'Patient:Sick person \\n Issues:';
              let issues = '';
              danger_signs = danger_signs.split(' ');
              async.eachSeries(
                danger_signs,
                (danger_sign, nxtDangerSign) => {
                  if (danger_sign === 'others') {
                    if (issues) {
                      issues += ', ';
                    }
                    let [susp_issues] = mixin.getDataFromJSON(
                      susp_pat,
                      'general_examination_others'
                    );
                    issues += susp_issues;
                    return nxtDangerSign();
                  }
                  const promises = [];
                  chadChoicesWorksheet.eachRow((chadRows, chadRowNum) => {
                    promises.push(
                      new Promise((resolve, reject) => {
                        if (
                          chadRows.values.includes('general_examination') &&
                          chadRows.values.includes(danger_sign)
                        ) {
                          if (issues) {
                            issues += ', ';
                          }
                          issues += chadRows.values[chadRows.values.length - 1];
                          resolve();
                        } else {
                          resolve();
                        }
                      })
                    );
                  });
                  Promise.all(promises).then(() => {
                    return nxtDangerSign();
                  });
                },
                () => {
                  sms += issues;
                  rapidpro.alertReferal(submission.username, sms);
                  return nxtSuspPat();
                }
              );
            } else {
              return nxtSuspPat();
            }
          });
        }
        mongo.saveSubmission(submission);
      }
    );
  });
};

module.exports = {
  addLocationToXLSForm,
  publishForm,
  downloadXLSForm,
  downloadJSONForm,
  downloadFormData,
  populateHouses,
  populatePregnantWomen,
  createAccount,
  shareFormWithUser,
  formList,
  forms,
  newSubmission,
  submitToAggregator,
};

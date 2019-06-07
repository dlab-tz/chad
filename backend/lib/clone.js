require('./init')
const cron = require('node-cron')
const winston = require('winston')
const rapidpro = require('./rapidpro')

cron.schedule('25 23 * * *', () => {
  winston.info('Running clinic reminder cron job')
  rapidpro.clinicReminder((err) => {
    winston.info('Finished running clinic reminder cron job')
  })
});
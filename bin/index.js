#!/usr/bin/env node
require('dotenv').config()
const log = require('loglevel')
const yargs = require('yargs')

const argv = yargs
  .usage('$0 command')
  .command(require('../init'))
  .command(require('../migrate'))
  .demand(1, 'must provide a valid command')
  .option('loglevel', {
    alias: 'l',
    description: 'set log-level',
    default: 'info'
  })
  .version()
  .help('h')
  .alias('h', 'help')
  .fail((msg, err, yargs) => {
    log.error(msg)
    process.exit(1)
  }).argv

log.setLevel(argv.loglevel)
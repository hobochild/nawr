const log = require('../log')

const table = (migrations, prefix) => {
  return migrations
    .map(({ file }) => {
      return `${prefix} ${file}`
    })
    .join('\n')
}

const execute = (umzug, type, opts) => {
  return umzug[type](opts)
}

const commit = transaction => {
  return async migrations => {
    if (!migrations || !migrations.length) {
      log.info('No migrations executed\n')
      // its important to return early and not call
      // commit see:  https://github.com/koxudaxi/local-data-api/issues/41
      return
    }

    try {
      log.wait(`Commiting ${migrations.length} migrations`)
      await transaction.commit()
      log.ready(`Commited ${migrations.length} migrations`)
      log.info(table(migrations, '✔'))
    } catch (err) {
      log.error(`Failed to commit ${migrations.length} migrations`)
      log.info(table(migrations, '✖'))
      throw err
    }
    return migrations
  }
}

execute.options = yargs => {
  yargs.option('from', {
    type: 'string',
    describe: 'target start migration'
  })

  yargs.option('to', {
    type: 'string',
    describe: 'target end migration'
  })
  return yargs
}

const api = {
  history: {
    command: 'history',
    describe: 'View migration history',
    handler: ({ migrator }) => {
      return migrator.storage.executed().then(function(migrations) {
        migrations = migrations.map(mig => ({ file: mig }))
        if (!migrations.length) log.info('No executed migrations\n')
        else {
          log.info(table(migrations, `✔ executed:`))
        }
      })
    }
  },
  pending: {
    command: 'pending',
    describe: 'View pending migrations',
    handler: function({ migrator }) {
      return migrator.pending().then(function(migrations) {
        if (!migrations.length) log.info('No pending migrations\n')
        else {
          log.info(table(migrations, `⚠ pending:`))
        }
      })
    }
  },
  up: {
    command: 'up',
    describe: 'migrate up',
    builder: execute.options,
    handler: function({ migrator, from, to, transaction }) {
      return execute(migrator, 'up', { from, to }).then(commit(transaction))
    }
  },
  down: {
    command: 'down',
    describe: 'migrate down',
    handler: function({ migrator, from, to, transaction }) {
      return execute(migrator, 'down', { from, to }).then(commit(transaction))
    },
    builder: execute.options
  }
}

module.exports = {
  api
}

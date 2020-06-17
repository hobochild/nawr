const Stage = require('./base')
const compose = require('docker-compose')
const path = require('path')

// https://github.com/koxudaxi/local-data-api
const LOCAL_CONNECTIONS = {
  resourceArn: 'arn:aws:rds:us-east-1:123456789012:cluster:dummy',
  secretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:dummy',
  database: 'master',
  options: {
    endpoint: 'http://127.0.0.7:8080'
  }
}

class DevelopmentState extends Stage {
  static getCredentials() {
    return {
      accessKeyId: 'local-dummy-accesskey',
      secretAccessKey: 'local-dummy-accesskey'
    }
  }

  _create() {
    return compose
      .upAll({
        cwd: path.join(__dirname, 'docker'),
        log: true,
        config: `${this.engine}.yml`
      })
      .then(
        () => {
          return LOCAL_CONNECTIONS
        },
        err => {
          throw err
        }
      )
  }
}

module.exports = DevelopmentState
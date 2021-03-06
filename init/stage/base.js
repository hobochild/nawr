const nanoid = require('../id')
const log = require('../../log')
const fs = require('fs')

class Stage {
  // base class
  constructor(id, engine, dir) {
    this.id = id ? id : nanoid()
    this.engine = engine
    this.dir = dir
  }

  _createDB() {
    // subclasses override this
    return Promise.resolve()
  }

  _waitDB() {
    // subclasses override this
    return Promise.resolve()
  }

  async createDB() {
    log.wait('Creating Database')
    try {
      this.connectionValues = await this._createDB(this.id)
      log.ready(`Database created: ${this.connectionValues.resourceArn}`)
      return this.connectionValues
    } catch (err) {
      log.error(`Failed to create database: ${err.message}`)
      throw err
    }
  }

  async waitDB() {
    try {
      log.wait(`Waiting on database to be available`)
      await this._waitDB()
      log.ready(`Database is available`)
    } catch (err) {
      log.error(`Database is not available`)
      throw err
    }

    return this.connectionValues
  }

  async createWorkers(env) {
    if (!fs.existsSync(this.dir + '/workers')) {
      return null
    }

    log.wait('Creating Workers')
    try {
      this.workersConnectionValues = await this._createWorkers(this.id, env)
      log.ready('Workers are ready')
      return this.workersConnectionValues
    } catch (err) {
      log.error(`Failed to create workers: ${err.message}`)
      throw err
    }
  }
}

module.exports = Stage
module.exports = Stage

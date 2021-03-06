const envfile = require('envfile')
const fs = require('fs').promises
const path = require('path')
const log = require('../log')
const pkg = require('../package.json')
const stages = require('./stage')
const { setCredentials } = require('./credentials')

const getEnv = async envFilePath => {
  const allowList = Object.entries(process.env).reduce((acc, [k, v]) => {
    if (k.startsWith('NAWR_')) {
      acc[k] = v
    }
    return acc
  }, {})

  // always use an .env file if available
  try {
    await fs.access(envFilePath)
    const env = envfile.parseFileSync(envFilePath)

    return {
      ...env,
      ...allowList
    }
  } catch (err) {
    // todo specifically handle err code
    // doesnt exist
    return allowList
  }
}

const setEnv = async (envFilePath, env) => {
  const envStr = envfile.stringifySync(env)
  await fs.writeFile(envFilePath, envStr)
}

const init = async ({ engine, stage, id }) => {
  const dir = process.cwd()
  setCredentials(stage)
  const infra = new stages[stage](id, 'aurora-' + engine, dir)
  const connectionValues = await infra.createDB()
  // // wait on available
  await infra.waitDB()

  const envFilePath = path.join(dir, '.env')

  // gets .env contents
  const env = await getEnv(envFilePath)

  const workersConnectionValues = await infra.createWorkers({
    ...env,
    NAWR_SQL_CONNECTION: JSON.stringify(connectionValues)
  })

  // set .env contents with connectionValues
  try {
    await setEnv(envFilePath, {
      ...env,
      NAWR_WORKER_CONNECTION: JSON.stringify(workersConnectionValues),
      NAWR_SQL_CONNECTION: JSON.stringify({
        ...connectionValues,
        version: pkg.version,
        stage,
        id
      })
    })
    log.info('Connection values saved to .env')
  } catch (err) {
    throw new Error('Could not save connection details in .env')
  }

  return env
}

// cli module
exports.command = 'init'
exports.describe = 'initialize sql db'
exports.builder = {
  engine: {
    alias: 'e',
    description: 'set storage engine',
    default: 'postgresql',
    choices: ['postgresql', 'mysql']
  },
  id: {
    description: 'set database id',
    type: 'string'
  },
  stage: {
    description: 'which stage to provision the database for',
    default: 'development',
    choices: ['development', 'preview', 'production']
  }
}
exports.handler = init
exports.getEnv = getEnv

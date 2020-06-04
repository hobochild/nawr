const AWS = require('aws-sdk')
const nanoid = require('./id')
const { promisify } = require('util')

const ensureEnv = (required, optional) => {
  for (key of required) {
    if (!process.env[key]) {
      throw new Error(`[Error]: ${key} is not set`)
    }
  }

  for (key of optional) {
    if (!process.env[key]) {
      console.log(`[warning]: ${key} is not set`)
    }
  }
}

ensureEnv(['NAWR_AWS_KEY_ID', 'NAWR_AWS_SECRET'], ['NAWR_AWS_REGION'])

const {
  NAWR_AWS_KEY_ID: accessKeyId,
  NAWR_AWS_SECRET: secretAccessKey,
  NAWR_AWS_REGION: region
} = process.env

const credentials = new AWS.Credentials({
  accessKeyId,
  secretAccessKey
})

AWS.config.update({
  credentials,
  region: region || process.env.AWS_REGION || 'us-east-1'
})

const rds = new AWS.RDS()
const secretsmanager = new AWS.SecretsManager()
const getSecret = promisify(secretsmanager.describeSecret).bind(secretsmanager)
const createSecret = promisify(secretsmanager.createSecret).bind(secretsmanager)
const createDBCluster = promisify(rds.createDBCluster).bind(rds)

const getDBs = promisify(rds.describeDBClusters).bind(rds)

async function getDBByName(name) {
  const { DBClusters } = await getDBs({
    Filters: [
      {
        Name: 'db-cluster-id' /* required */,
        Values: [
          /* required */
          name
          /* more items */
        ]
      }
    ]
  })

  const [db] = DBClusters
  if (!db) {
    throw new Error('Database does not exist')
  }
  return db
}

async function getDBStatus(dbArn) {
  const { DBClusters } = await getDBs({
    DBClusterIdentifier: dbArn
  })

  const [db] = DBClusters
  if (!db) {
    throw new Error('Database does not exist')
  }
  return db.Status
}

async function sleep(timeout) {
  return new Promise(res => {
    setTimeout(() => {
      res()
    }, timeout)
  })
}

async function waitOnAvailable(dbArn) {
  let status = null

  while (status !== 'available') {
    console.log('checking availablility')
    status = await getDBStatus(dbArn)
    await sleep(5000)
  }

  console.log('DB is ready')
  return status
}

// Creates a serverless postgres db + sercret for acess via the data-api
// * @param {string} deploymentId - vercel deploymentId
async function createDB(identifier, { opts }) {
  console.log({ identifier })
  const username = 'master'
  const dbName = 'master'
  const password = process.env.NAWR_SQL_PASSWORD || nanoid()

  let db
  let secret

  try {
    // TODO add tags
    db = await createDBCluster({
      DatabaseName: dbName,
      EngineMode: 'serverless',
      Engine: 'aurora-postgresql',
      EnableHttpEndpoint: true,
      DBClusterIdentifier: identifier,
      MasterUsername: username,
      MasterUserPassword: password,
      ScalingConfiguration: {
        AutoPause: true,
        MaxCapacity: 4,
        MinCapacity: 2,
        SecondsUntilAutoPause: 300
      },
      ...opts
    }).then(data => data.DBCluster)
  } catch (err) {
    if (err.code === 'DBClusterAlreadyExistsFault') {
      db = await getDBByName(identifier)
    } else {
      throw new Error(`[Could not create DBCluster]: ${err.message}`)
    }
  }

  try {
    secret = await createSecret({
      ClientRequestToken: nanoid(),
      Description: 'next-sql-db-password',
      Name: identifier,
      SecretString: JSON.stringify({
        username: username,
        password: password,
        engine: 'postgres',
        host: db.Endpoint,
        port: 5432,
        dbClusterIdentifier: identifier
      })
    })
  } catch (err) {
    if (err.code === 'ResourceExistsException') {
      try {
        secret = await getSecret({
          SecretId: identifier
        }).catch(console.log)
      } catch (err) {
        if (!sercret) {
          throw new Error(`[Could not find DBCluster secret]: ${err.message}`)
        }
      }
    } else {
      throw new Error(`[Could not create DBCluster secret]: ${err.message}`)
    }
  }

  return {
    resourceArn: db.DBClusterArn,
    secretArn: secret.ARN,
    database: dbName
  }
}

module.exports = {
  createDB,
  waitOnAvailable,
  AWS
}

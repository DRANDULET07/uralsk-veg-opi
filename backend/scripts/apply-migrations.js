const { spawnSync } = require('node:child_process')
const { existsSync, readdirSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const containerName = 'uralsk-veg-opi-postgres'
const databaseUser = 'uralsk_veg'
const databaseName = 'uralsk_veg_opi'
const migrationsDir = join(__dirname, '..', 'prisma', 'migrations')

function runDockerPsql(sql) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      containerName,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      databaseUser,
      '-d',
      databaseName,
    ],
    {
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit'],
      encoding: 'utf8',
    },
  )

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`Migration failed with exit code ${result.status}`)
  }
}

function main() {
  if (!existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`)
  }

  const migrationFiles = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => join(migrationsDir, item.name, 'migration.sql'))
    .filter((filePath) => existsSync(filePath))
    .sort()

  if (migrationFiles.length === 0) {
    console.log('No SQL migrations found.')
    return
  }

  for (const filePath of migrationFiles) {
    console.log(`Applying migration: ${filePath}`)
    runDockerPsql(readFileSync(filePath, 'utf8'))
  }

  console.log('Migrations applied successfully.')
}

main()

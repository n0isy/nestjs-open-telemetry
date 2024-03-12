import type { Type } from '@nestjs/common'
import { Inject, Injectable, Logger } from '@nestjs/common'
import type {
  DataSource,
  DatabaseType,
  EntityManager,
  EntityMetadata,
  EntityTarget,
  QueryRunner,
} from 'typeorm'
import {
  DBSYSTEMVALUES_CACHE,
  DBSYSTEMVALUES_COCKROACHDB,
  DBSYSTEMVALUES_HANADB,
  DBSYSTEMVALUES_MARIADB,
  DBSYSTEMVALUES_MONGODB,
  DBSYSTEMVALUES_MSSQL,
  DBSYSTEMVALUES_MYSQL,
  DBSYSTEMVALUES_ORACLE,
  DBSYSTEMVALUES_OTHER_SQL,
  DBSYSTEMVALUES_POSTGRESQL,
  DBSYSTEMVALUES_SQLITE,
  SEMATTRS_DB_CONNECTION_STRING,
  SEMATTRS_DB_NAME,
  SEMATTRS_DB_OPERATION,
  SEMATTRS_DB_SQL_TABLE,
  SEMATTRS_DB_STATEMENT,
  SEMATTRS_DB_SYSTEM,
  SEMATTRS_DB_USER,
  SEMATTRS_NET_PEER_NAME,
  SEMATTRS_NET_PEER_PORT,
} from '@opentelemetry/semantic-conventions'
import type { BaseDataSourceOptions } from 'typeorm/data-source/BaseDataSourceOptions'
import type { DataSourceOptions } from 'typeorm/data-source/DataSourceOptions'
import type { Attributes } from '@opentelemetry/api/build/src/common/Attributes'
import { SpanKind, context, trace } from '@opentelemetry/api'
import { Span } from '@opentelemetry/sdk-trace-base'
import { ModulesContainer } from '@nestjs/core'
import { SDK_CONFIG } from '../../open-telemetry.enums'
import type { OpenTelemetryModuleConfig } from '../../open-telemetry.interface'
import { BaseInjector } from './base.injector'

export interface TypeormInjectorOptions {
  /** set to `true` if you want to capture the parameter values for parameterized SQL queries (**may leak sensitive information**) */
  collectParameters?: boolean
}

export const DB_STATEMENT_PARAMETERS = 'db.statement.parameters'

type EntityManagerMethods = keyof EntityManager
const usingEntityPersistExecutor: EntityManagerMethods[] = ['save', 'remove', 'softRemove', 'recover']
const usingQueryBuilder: EntityManagerMethods[] = [
  'insert',
  'update',
  'delete',
  'softDelete',
  'restore',
  'count',
  'find',
  'findAndCount',
  'findByIds',
  'findOne',
  'increment',
  'decrement',
]
const entityManagerMethods: EntityManagerMethods[] = [
  ...usingEntityPersistExecutor,
  ...usingQueryBuilder,
]

function getDbSystemValue(options: BaseDataSourceOptions): string {
  switch (options.type) {
    case 'mysql':
    case 'aurora-mysql':
      return DBSYSTEMVALUES_MYSQL
    case 'postgres':
    case 'aurora-postgres':
      return DBSYSTEMVALUES_POSTGRESQL
    case 'cockroachdb':
      return DBSYSTEMVALUES_COCKROACHDB
    case 'sap':
      return DBSYSTEMVALUES_HANADB
    case 'mariadb':
      return DBSYSTEMVALUES_MARIADB
    case 'oracle':
      return DBSYSTEMVALUES_ORACLE
    case 'mssql':
      return DBSYSTEMVALUES_MSSQL
    case 'mongodb':
      return DBSYSTEMVALUES_MONGODB
    case 'sqlite':
    case 'cordova':
    case 'react-native':
    case 'nativescript':
    case 'expo':
    case 'better-sqlite3':
    case 'capacitor':
    case 'sqljs':
      return DBSYSTEMVALUES_SQLITE
    case 'spanner':
    default:
      return DBSYSTEMVALUES_OTHER_SQL
  }
}

const sqliteFamily: DatabaseType[] = ['sqlite', 'cordova', 'react-native', 'nativescript', 'expo', 'better-sqlite3', 'capacitor', 'sqljs']

const auroraFamily: DatabaseType[] = ['aurora-mysql', 'aurora-postgres']

function getDefaultPort(type: DatabaseType): number | undefined {
  switch (type) {
    case 'mysql':
      return 3306
    case 'postgres':
      return 5432
    case 'cockroachdb':
      return 26257
    case 'sap':
      return 39015
    case 'mariadb':
      return 3306
    case 'oracle':
      return 1521
    case 'mssql':
      return 1433
    case 'mongodb':
      return 27017
    case 'sqlite':
    case 'cordova':
    case 'react-native':
    case 'nativescript':
    case 'expo':
    case 'better-sqlite3':
    case 'capacitor':
    case 'sqljs':
    case 'spanner':
    default:
      return void 0
  }
}

export function getConnectionAttributes(options: DataSourceOptions): Attributes {
  if (sqliteFamily.includes(options.type)) {
    return {
      [SEMATTRS_DB_SYSTEM]: DBSYSTEMVALUES_SQLITE,
      [SEMATTRS_DB_CONNECTION_STRING]: typeof options.database === 'string' ? options.database : DBSYSTEMVALUES_CACHE,
    }
  }
  else if (!sqliteFamily.concat(auroraFamily).includes(options.type)) {
    const connectionOptions = options as any
    let host: string | undefined = connectionOptions.host || 'localhost'
    let port: number | undefined = connectionOptions.port || getDefaultPort(options.type)
    let user: string | undefined = connectionOptions.username
    let database = typeof options.database === 'string' ? options.database : void 0
    if (connectionOptions.url) {
      const url = new URL(connectionOptions.url)
      port = Number(url.port) || port
      host = url.hostname
      user = url.username
      database = url.pathname.slice(1) || database
    }
    return {
      [SEMATTRS_DB_SYSTEM]: getDbSystemValue(options),
      [SEMATTRS_DB_CONNECTION_STRING]: `${options.type}://${user ? `${user}@` : ''}${host}:${port}${database ? `/${database}` : ''}`,
      [SEMATTRS_NET_PEER_NAME]: host,
      [SEMATTRS_NET_PEER_PORT]: port,
      [SEMATTRS_DB_USER]: user,
      [SEMATTRS_DB_NAME]: database,
    }
  }
  return {
    [SEMATTRS_DB_SYSTEM]: getDbSystemValue(options),
    [SEMATTRS_DB_NAME]: typeof options.database === 'string' ? options.database : void 0,
  }
}

const attributeCache = new Map<DataSource, Attributes>()
function getSemanticAttributes(dataSource: DataSource): Attributes {
  if (!attributeCache.has(dataSource)) {
    const options = dataSource.options
    const attributes = getConnectionAttributes(options)
    attributeCache.set(dataSource, attributes)
  }
  return attributeCache.get(dataSource)!
}

@Injectable()
export class TypeormInjector extends BaseInjector {
  private readonly logger = new Logger(TypeormInjector.name)
  private readonly config: TypeormInjectorOptions
  constructor(
    modulesContainer: ModulesContainer,
    @Inject(SDK_CONFIG)
      config: OpenTelemetryModuleConfig,
  ) {
    super(modulesContainer)
    if (config.injectorsConfig?.[TypeormInjector.name])
      this.config = config.injectorsConfig[TypeormInjector.name] as TypeormInjectorOptions
    else
      this.config = {}
  }

  public inject(): void {
    this.injectQueryRunner()
    this.injectEntityManager()
  }

  public injectEntityManager(): void {
    const prototype = this.loadDependencies('EntityManager')?.prototype
    if (!prototype)
      return

    for (const key of entityManagerMethods) {
      if (!this.isAffected(prototype[key])) {
        const name = `TypeORM -> EntityManager -> ${key}`
        prototype[key] = this.wrap(
          prototype[key],
          name,
          {},
          true,
          ({ args, thisArg }) => {
            const entityManager = thisArg as EntityManager
            let metadata: EntityMetadata
            if (usingEntityPersistExecutor.includes(key)) {
              const entityOrTarget = args[0] as EntityTarget<any> | object | object[]
              let target: EntityTarget<any>
              if (Array.isArray(entityOrTarget))
                target = entityOrTarget[0].constructor
              else if (
                typeof entityOrTarget === 'function'
                || (entityOrTarget as { '@instanceof': symbol })['@instanceof'] === Symbol.for('EntitySchema')
              )
                target = entityOrTarget as EntityTarget<any>
              else
                target = typeof entityOrTarget === 'string' ? entityOrTarget : entityOrTarget.constructor
              metadata = entityManager.connection.getMetadata(target)
            }
            else {
              metadata = entityManager.connection.getMetadata(args[0] as EntityTarget<any>)
            }
            return {
              [SEMATTRS_DB_NAME]: metadata.schema ?? metadata.database,
              [SEMATTRS_DB_SQL_TABLE]: metadata.tableName,
              ...getSemanticAttributes(entityManager.connection),
            }
          },
        )
        this.logger.log(`Mapped ${name}`)
      }
    }
  }

  private injectQueryRunner(): void {
    this.loadFastGlob()?.sync('typeorm/driver/*/*.js', { cwd: 'node_modules' })
      .filter(f => f.includes('QueryRunner'))
      .forEach((filePath) => {
        // eslint-disable-next-line ts/no-require-imports,ts/no-var-requires
        const moduleExports = require(filePath)
        const [, queryRunner] = Object.entries<Type<QueryRunner>>(moduleExports).find(([name, type]) => name.includes('QueryRunner') && typeof type === 'function') ?? []
        if (!queryRunner)
          return
        const prototype = queryRunner.prototype
        if (prototype.query === undefined)
          return

        prototype.query = this.wrap(
          prototype.query,
          'TypeORM -> raw query',
          {
            kind: SpanKind.CLIENT,
          },
          true,
          ({ args, thisArg, parentSpan }) => {
            const runner = thisArg as QueryRunner
            const parentAttributes = parentSpan instanceof Span ? parentSpan.attributes : {}
            const statement = args[0] as string
            const operation = statement.trim().split(' ')[0].toUpperCase()
            const span = trace.getSpan(context.active())
            span?.updateName(`TypeORM -> ${operation}`)
            const attributes: Attributes = {
              [SEMATTRS_DB_STATEMENT]: args[0] as string,
              [SEMATTRS_DB_NAME]: parentAttributes[SEMATTRS_DB_NAME],
              [SEMATTRS_DB_SQL_TABLE]: parentAttributes[SEMATTRS_DB_SQL_TABLE],
              [SEMATTRS_DB_OPERATION]: operation,
              ...getSemanticAttributes(runner.connection),
            }
            if (this.config.collectParameters) {
              try {
                attributes[DB_STATEMENT_PARAMETERS] = JSON.stringify(args[1])
              }
              catch (e) {}
            }
            return attributes
          },
        )
        this.logger.log(`Mapped ${queryRunner.name}`)
      })
  }

  private loadDependencies<T extends keyof typeof import('typeorm')>(key: T): Type<(typeof import('typeorm'))[T]> | undefined {
    try {
      // eslint-disable-next-line ts/no-require-imports,ts/no-var-requires
      return require('typeorm')[key]
    }
    catch (e) {
      this.logger.warn('typeorm is not installed, TypeormInjector will be disabled.')
      return void 0
    }
  }

  private loadFastGlob(): typeof import('fast-glob') | undefined {
    try {
      // eslint-disable-next-line ts/no-require-imports
      return require('fast-glob')
    }
    catch (e) {
      this.logger.warn('fast-glob is not installed, TypeormInjector will be disabled.')
      return void 0
    }
  }
}

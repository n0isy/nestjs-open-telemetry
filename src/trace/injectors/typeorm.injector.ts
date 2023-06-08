import fg from 'fast-glob'
import type { Type } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import type { DatabaseType, EntityManager, EntityMetadata, EntityTarget, QueryRunner } from 'typeorm'
import { DbSystemValues, SemanticAttributes } from '@opentelemetry/semantic-conventions'
import type { BaseDataSourceOptions } from 'typeorm/data-source/BaseDataSourceOptions'
import type { DataSourceOptions } from 'typeorm/data-source/DataSourceOptions'
import type { Attributes } from '@opentelemetry/api/build/src/common/Attributes'
import { SpanKind } from '@opentelemetry/api'
import { Span } from '@opentelemetry/sdk-trace-base'
import { BaseInjector } from './base.injector'

function getDbSystemValue(options: BaseDataSourceOptions): DbSystemValues {
  switch (options.type) {
    case 'mysql':
    case 'aurora-mysql':
      return DbSystemValues.MYSQL
    case 'postgres':
    case 'aurora-postgres':
      return DbSystemValues.POSTGRESQL
    case 'cockroachdb':
      return DbSystemValues.COCKROACHDB
    case 'sap':
      return DbSystemValues.HANADB
    case 'mariadb':
      return DbSystemValues.MARIADB
    case 'oracle':
      return DbSystemValues.ORACLE
    case 'mssql':
      return DbSystemValues.MSSQL
    case 'mongodb':
      return DbSystemValues.MONGODB
    case 'sqlite':
    case 'cordova':
    case 'react-native':
    case 'nativescript':
    case 'expo':
    case 'better-sqlite3':
    case 'capacitor':
    case 'sqljs':
      return DbSystemValues.SQLITE
    case 'spanner':
    default:
      return DbSystemValues.OTHER_SQL
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

function getConnectionAttributes(options: DataSourceOptions): Attributes {
  if (sqliteFamily.includes(options.type)) {
    return {
      [SemanticAttributes.DB_SYSTEM]: DbSystemValues.SQLITE,
      [SemanticAttributes.DB_CONNECTION_STRING]: typeof options.database === 'string' ? options.database : DbSystemValues.CACHE,
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
      [SemanticAttributes.DB_SYSTEM]: getDbSystemValue(options),
      [SemanticAttributes.DB_CONNECTION_STRING]: `${options.type}://${host}:${port}${database ? `/${database}` : ''}`,
      [SemanticAttributes.NET_PEER_NAME]: host,
      [SemanticAttributes.NET_PEER_PORT]: port,
      [SemanticAttributes.DB_USER]: user,
      [SemanticAttributes.DB_NAME]: database,
    }
  }
  return {
    [SemanticAttributes.DB_SYSTEM]: getDbSystemValue(options),
    [SemanticAttributes.DB_NAME]: typeof options.database === 'string' ? options.database : void 0,
  }
}

const attributeCache = new Map<QueryRunner, Attributes>()
function getSemanticAttributes(queryRunner: QueryRunner): Attributes {
  if (!attributeCache.has(queryRunner)) {
    const options = queryRunner.connection.options
    const attributes = getConnectionAttributes(options)
    attributeCache.set(queryRunner, attributes)
  }
  return attributeCache.get(queryRunner)!
}

@Injectable()
export class TypeormInjector extends BaseInjector {
  private readonly logger = new Logger(TypeormInjector.name)
  public inject(): void {
    this.injectQueryRunner()
    this.injectEntityManager()
  }

  public injectEntityManager(): void {
    const prototype = this.loadEntityManager().prototype as any
    const keys = this.metadataScanner.getAllMethodNames(
      prototype,
    )
    const excludeKeys = ['transaction', 'query', 'createQueryBuilder', 'hasId', 'getId', 'withRepository', 'getCustomRepository', 'release']

    for (const key of keys) {
      if (!excludeKeys.includes(key) && !this.isAffected(prototype[key])) {
        const name = `TypeORM -> EntityManager -> ${prototype[key].name}`
        const func = prototype[key] as Function
        prototype[key] = this.wrap(
          func,
          name,
          {},
          true,
          ({ args, thisArg }) => {
            const entityManager = thisArg as EntityManager
            let metadata: EntityMetadata
            if (['save', 'remove', 'softRemove', 'recover'].includes(func.name)) {
              const entityOrTarget = args[0] as EntityTarget<any> | object | object[]
              let target: EntityTarget<any>
              if (Array.isArray(entityOrTarget))
                target = entityOrTarget[0].constructor
              else if (
                typeof entityOrTarget === 'function'
                || (entityOrTarget as { '@instanceof': Symbol })['@instanceof'] === Symbol.for('EntitySchema')
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
              [SemanticAttributes.DB_NAME]: metadata.schema ?? metadata.database,
              [SemanticAttributes.DB_SQL_TABLE]: metadata.tableName,
            }
          },
        )
        this.logger.log(`Mapped ${name}`)
      }
    }
  }

  private loadEntityManager(): Type<EntityManager> | never {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-require-imports
      return require('typeorm').EntityManager
    }
    catch (e) {
      this.logger.error('typeorm not installed')
      throw e
    }
  }

  private injectQueryRunner(): void {
    fg.sync('typeorm/driver/*/*.js', { cwd: 'node_modules' })
      .filter(f => f.includes('QueryRunner'))
      .forEach((filePath) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-require-imports
        const moduleExports = require(filePath)
        const [, queryRunner] = Object.entries<Type<QueryRunner>>(moduleExports).find(([name, type]) => name.includes('QueryRunner') && typeof type === 'function') ?? []
        if (!queryRunner)
          return
        const prototype = queryRunner.prototype
        const func = prototype.query
        if (func === undefined)
          return
        prototype.query = this.wrap(
          func,
          'TypeORM -> query',
          {
            kind: SpanKind.CLIENT,
          },
          true,
          ({ args, thisArg, parentSpan }) => {
            const runner = thisArg as QueryRunner
            const parentAttributes = parentSpan instanceof Span ? parentSpan.attributes : {}
            return {
              [SemanticAttributes.DB_STATEMENT]: args[0] as string,
              [SemanticAttributes.DB_NAME]: parentAttributes[SemanticAttributes.DB_NAME],
              [SemanticAttributes.DB_SQL_TABLE]: parentAttributes[SemanticAttributes.DB_SQL_TABLE],
              ...getSemanticAttributes(runner),
            }
          },
        )
        this.logger.log(`Mapped ${queryRunner.name}`)
      })
  }
}

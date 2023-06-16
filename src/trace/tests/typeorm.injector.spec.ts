import { Test } from '@nestjs/testing'
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { Column, DataSource, Entity, PrimaryColumn } from 'typeorm'
import { DataSourceOptions } from 'typeorm/data-source/DataSourceOptions'
import { DbSystemValues, SemanticAttributes } from '@opentelemetry/semantic-conventions'
import { OpenTelemetryModule } from '../../open-telemetry.module'
import { DecoratorInjector, TypeormInjector, getConnectionAttributes } from '../injectors'
import { Trace } from '../decorators'

describe('TypeORM Injector Test', () => {
  @Entity()
  class User {
    @PrimaryColumn()
    id!: number

    @Column()
    firstName: string

    @Column()
    lastName: string

    constructor(id: number, firstName: string, lastName: string) {
      this.id = id
      this.firstName = firstName
      this.lastName = lastName
    }
  }
  const defaultOptions: DataSourceOptions = {
    type: 'sqlite',
    database: ':memory:',
    dropSchema: true,
    synchronize: true,
    entities: [User],
  }

  const exporter = new NoopSpanProcessor()
  const exporterSpy = jest.spyOn(exporter, 'onStart')

  const sdkModule = OpenTelemetryModule.forRoot({
    spanProcessor: exporter,
    autoInjectors: [DecoratorInjector, TypeormInjector],
    injectorsConfig: {
      TypeormInjector: {
        collectParameters: true,
      },
    },
  })

  beforeEach(() => {
    exporterSpy.mockClear()
    exporterSpy.mockReset()
  })

  it('getConnectionAttributes', async () => {
    const attributes = getConnectionAttributes(defaultOptions)
    expect(attributes[SemanticAttributes.DB_SYSTEM]).toStrictEqual('sqlite')
    expect(attributes[SemanticAttributes.DB_CONNECTION_STRING]).toStrictEqual(':memory:')

    const attributes1 = getConnectionAttributes({
      type: 'postgres',
      url: 'postgres://postgres:postgres@localhost/postgres',
    })
    expect(attributes1[SemanticAttributes.DB_SYSTEM]).toStrictEqual(DbSystemValues.POSTGRESQL)
    expect(attributes1[SemanticAttributes.DB_CONNECTION_STRING]).toStrictEqual('postgres://postgres@localhost:5432/postgres')
    expect(attributes1[SemanticAttributes.DB_USER]).toStrictEqual('postgres')
    expect(attributes1[SemanticAttributes.DB_NAME]).toStrictEqual('postgres')
    expect(attributes1[SemanticAttributes.NET_PEER_NAME]).toStrictEqual('localhost')
    expect(attributes1[SemanticAttributes.NET_PEER_PORT]).toStrictEqual(5432)

    const attributes2 = getConnectionAttributes({
      type: 'mysql',
      password: 'root',
      database: 'test',
    })
    expect(attributes2[SemanticAttributes.DB_SYSTEM]).toStrictEqual(DbSystemValues.MYSQL)
    expect(attributes2[SemanticAttributes.DB_CONNECTION_STRING]).toStrictEqual('mysql://localhost:3306/test')
    expect(attributes2[SemanticAttributes.DB_USER]).toBeUndefined()
    expect(attributes2[SemanticAttributes.DB_NAME]).toStrictEqual('test')
    expect(attributes2[SemanticAttributes.NET_PEER_NAME]).toStrictEqual('localhost')
    expect(attributes2[SemanticAttributes.NET_PEER_PORT]).toStrictEqual(3306)

    const attributes3 = getConnectionAttributes({
      type: 'aurora-postgres',
      database: 'test',
      region: '',
      resourceArn: '',
      secretArn: '',
    })
    expect(attributes3[SemanticAttributes.DB_SYSTEM]).toStrictEqual(DbSystemValues.POSTGRESQL)
    expect(attributes3[SemanticAttributes.DB_NAME]).toStrictEqual('test')
  })

  it('should trace EntityManager', async () => {
    // given
    @Injectable()
    class TestService implements OnModuleInit {
      private dataSource!: DataSource
      async onModuleInit(): Promise<void> {
        this.dataSource = new DataSource(defaultOptions)
        await this.dataSource.initialize()
      }

      @Trace()
      async test() {
        const entityManager = this.dataSource.createEntityManager()
        await entityManager.save(new User(1, 'John', 'Doe'))
        await entityManager.update(User, { id: 1 }, { firstName: 'Jane' })
        const users = await entityManager.find(User)
        await entityManager.remove(User, users)
      }
    }

    const context = await Test.createTestingModule({
      imports: [sdkModule],
      providers: [TestService],
    }).compile()
    const app = context.createNestApplication()
    await app.init()
    const testService = app.get(TestService)

    // when
    await testService.test()

    // then
    const spans = exporterSpy.mock.calls.map(call => call[0])
    expect(spans.length).toStrictEqual(15)
    expect(spans[0].name).toStrictEqual('Provider -> TestService.test')
    expect(spans[1].name).toStrictEqual('TypeORM -> EntityManager -> save')
    expect(spans[2].name).toStrictEqual('TypeORM -> SELECT')
    expect(spans[3].name).toStrictEqual('TypeORM -> BEGIN')
    expect(spans[4].name).toStrictEqual('TypeORM -> INSERT')
    expect(spans[5].name).toStrictEqual('TypeORM -> COMMIT')
    expect(spans[6].name).toStrictEqual('TypeORM -> EntityManager -> update')
    expect(spans[7].name).toStrictEqual('TypeORM -> UPDATE')
    expect(spans[8].name).toStrictEqual('TypeORM -> EntityManager -> find')
    expect(spans[9].name).toStrictEqual('TypeORM -> SELECT')
    expect(spans[10].name).toStrictEqual('TypeORM -> EntityManager -> remove')
    expect(spans[11].name).toStrictEqual('TypeORM -> SELECT')
    expect(spans[12].name).toStrictEqual('TypeORM -> BEGIN')
    expect(spans[13].name).toStrictEqual('TypeORM -> DELETE')
    expect(spans[14].name).toStrictEqual('TypeORM -> COMMIT')
    await app.close()
  })
})

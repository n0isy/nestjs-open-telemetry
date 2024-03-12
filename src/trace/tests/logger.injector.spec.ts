import { Test } from '@nestjs/testing'
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base'
import {
  Controller,
  Get,
  Logger,
} from '@nestjs/common'
import request from 'supertest'
import {
  ControllerInjector,
  LoggerInjector,
} from '../injectors'
import { OpenTelemetryModule } from '../../open-telemetry.module'

describe('tracing logger injector test', () => {
  const exporter = new NoopSpanProcessor()
  const exporterSpy = jest.spyOn(exporter, 'onStart')

  const sdkModule = OpenTelemetryModule.forRoot({
    spanProcessors: [exporter],
    autoInjectors: [LoggerInjector, ControllerInjector],
  })

  beforeEach(() => {
    exporterSpy.mockClear()
    exporterSpy.mockReset()
  })

  it('should trace test middleware', async () => {
    @Controller('hello')
    class HelloController {
      private readonly logger = new Logger(HelloController.name)
      @Get()
      hi() {
        this.logger.log('hello')
      }
    }

    const context = await Test.createTestingModule({
      imports: [sdkModule],
      controllers: [HelloController],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await request(app.getHttpServer()).get('/hello').send().expect(200)

    // then
    const spans = exporterSpy.mock.calls.map(call => call[0])
    expect(spans.length).toStrictEqual(1)
    expect(spans[0].name).toStrictEqual('Controller -> HelloController.hi')
    expect(spans[0].events.length).toStrictEqual(1)
    expect(spans[0].events[0].name).toStrictEqual('log')
    expect(spans[0].events[0].attributes).toMatchObject({
      message: 'hello',
    })

    await app.close()
  })
})

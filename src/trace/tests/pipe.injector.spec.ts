import { Test } from '@nestjs/testing'
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base'
import type { PipeTransform } from '@nestjs/common'
import { Controller, Get, Param, UsePipes } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import request from 'supertest'
import { ControllerInjector, PipeInjector } from '../injectors'
import { OpenTelemetryModule } from '../../open-telemetry.module'
import { AttributeNames, EnhancerScope } from '../../open-telemetry.enums'

describe('tracing pipe injector test', () => {
  class TestPipe implements PipeTransform {
    async transform(v: any) { return v }
  }
  const exporter = new NoopSpanProcessor()
  const exporterSpy = jest.spyOn(exporter, 'onStart')

  const sdkModule = OpenTelemetryModule.forRoot({
    spanProcessors: [exporter],
    autoInjectors: [ControllerInjector, PipeInjector],
  })

  beforeEach(() => {
    exporterSpy.mockClear()
    exporterSpy.mockReset()
  })

  it('should trace enhanced controller', async () => {
    @UsePipes(TestPipe)
    @Controller('hello')
    class HelloController {
      @Get('/:id')
      hi(@Param('id') _id: string) { }
    }
    const context = await Test.createTestingModule({
      imports: [sdkModule],
      controllers: [HelloController],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await request(app.getHttpServer()).get('/hello/1').send().expect(200)

    // then
    const spans = exporterSpy.mock.calls.map(call => call[0])
    expect(spans.length).toStrictEqual(2)
    expect(spans[0].name).toStrictEqual('Pipe -> HelloController.TestPipe')
    expect(spans[1].name).toStrictEqual('Controller -> HelloController.hi')

    await app.close()
  })

  it('should trace enhanced method and param', async () => {
    @Controller('hello')
    class HelloController {
      @Get('/:id')
      @UsePipes(TestPipe)
      hi(@Param('id', TestPipe) _id: string) { }
    }
    const context = await Test.createTestingModule({
      imports: [sdkModule],
      controllers: [HelloController],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await request(app.getHttpServer()).get('/hello/1').send().expect(200)

    // then
    const spans = exporterSpy.mock.calls.map(call => call[0])
    expect(spans.length).toStrictEqual(3)
    expect(spans[0].name).toStrictEqual('Pipe -> HelloController.hi.TestPipe')
    expect(spans[1].name).toStrictEqual('Pipe -> HelloController.hi.0.TestPipe')
    expect(spans[2].name).toStrictEqual('Controller -> HelloController.hi')

    expect(spans[1].attributes[AttributeNames.ENHANCER_SCOPE]).toStrictEqual(EnhancerScope.PARAM)
    expect(spans[1].attributes[AttributeNames.PARAM_INDEX]).toStrictEqual(0)

    await app.close()
  })

  it('should trace global enhancer', async () => {
    @Controller('hello')
    class HelloController {
      @Get('/:id')
      hi(@Param('id') _id: string) {}
    }
    const context = await Test.createTestingModule({
      imports: [sdkModule],
      controllers: [HelloController],
      providers: [
        {
          provide: APP_PIPE,
          useClass: TestPipe,
        },
      ],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await request(app.getHttpServer()).get('/hello/1').send().expect(200)

    // then
    const spans = exporterSpy.mock.calls.map(call => call[0])
    expect(spans.length).toStrictEqual(2)
    expect(spans[0].name).toStrictEqual('Pipe -> Global -> TestPipe')
    expect(spans[1].name).toStrictEqual('Controller -> HelloController.hi')

    await app.close()
  })
})

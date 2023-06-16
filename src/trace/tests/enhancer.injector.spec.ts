import { Test } from '@nestjs/testing'
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base'
import {
  ArgumentsHost, CallHandler,
  CanActivate,
  Catch,
  Controller,
  ExceptionFilter, ExecutionContext,
  Get,
  NestInterceptor, UseFilters,
  UseGuards, UseInterceptors,
} from '@nestjs/common'
import request from 'supertest'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { Observable } from 'rxjs'
import { ControllerInjector, GuardInjector, InterceptorInjector } from '../injectors'
import { OpenTelemetryModule } from '../../open-telemetry.module'
import { ExceptionFilterInjector } from '../injectors/exception-filter.injector'

describe('Tracing Enhancer Injector Test', () => {
  class TestGuard implements CanActivate {
    canActivate() {
      return true
    }
  }

  class TestInterceptor implements NestInterceptor {
    intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
      return next.handle()
    }
  }

  @Catch()
  class TestExceptionFilter implements ExceptionFilter {
    catch(_: Error, host: ArgumentsHost) { host.switchToHttp().getResponse().status(200).send() }
  }
  const exporter = new NoopSpanProcessor()
  const exporterSpy = jest.spyOn(exporter, 'onStart')

  const sdkModule = OpenTelemetryModule.forRoot({
    spanProcessor: exporter,
    autoInjectors: [GuardInjector, InterceptorInjector, ExceptionFilterInjector, ControllerInjector],
  })

  beforeEach(() => {
    exporterSpy.mockClear()
    exporterSpy.mockReset()
  })

  it('should trace enhanced controller', async () => {
    @UseGuards(TestGuard)
    @UseInterceptors(TestInterceptor)
    @UseFilters(TestExceptionFilter)
    @Controller('hello')
    class HelloController {
      @Get()
      hi() {
        throw new Error('test')
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
    expect(spans.length).toStrictEqual(4)
    expect(spans[0].name).toStrictEqual('Guard -> HelloController.TestGuard')
    expect(spans[1].name).toStrictEqual('Interceptor -> HelloController.TestInterceptor')
    expect(spans[2].name).toStrictEqual('Controller -> HelloController.hi')
    expect(spans[3].name).toStrictEqual('ExceptionFilter -> HelloController.TestExceptionFilter')

    await app.close()
  })

  it('should trace enhanced controller method', async () => {
    @Controller('hello')
    class HelloController {
      @Get()
      @UseGuards(TestGuard)
      @UseInterceptors(TestInterceptor)
      @UseFilters(TestExceptionFilter)
      hi() {
        throw new Error('test')
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
    expect(spans.length).toStrictEqual(4)
    expect(spans[0].name).toStrictEqual('Guard -> HelloController.hi.TestGuard')
    expect(spans[1].name).toStrictEqual('Interceptor -> HelloController.hi.TestInterceptor')
    expect(spans[2].name).toStrictEqual('Controller -> HelloController.hi')
    expect(spans[3].name).toStrictEqual('ExceptionFilter -> HelloController.hi.TestExceptionFilter')

    await app.close()
  })

  it('should trace enhanced controller method with enhancer instance', async () => {
    @Controller('hello')
    class HelloController {
      @Get()
      @UseGuards(new TestGuard())
      @UseInterceptors(new TestInterceptor())
      @UseFilters(new TestExceptionFilter())
      hi() {
        throw new Error('test')
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
    expect(spans.length).toStrictEqual(4)
    expect(spans[0].name).toStrictEqual('Guard -> HelloController.hi.TestGuard')
    expect(spans[1].name).toStrictEqual('Interceptor -> HelloController.hi.TestInterceptor')
    expect(spans[2].name).toStrictEqual('Controller -> HelloController.hi')
    expect(spans[3].name).toStrictEqual('ExceptionFilter -> HelloController.hi.TestExceptionFilter')

    await app.close()
  })

  it('should trace global enhancer', async () => {
    @Controller('hello')
    class HelloController {
      @Get()
      async hi() {
        throw new Error('test')
      }
    }
    const context = await Test.createTestingModule({
      imports: [sdkModule],
      controllers: [HelloController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: TestGuard,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: TestInterceptor,
        },
        {
          provide: APP_FILTER,
          useClass: TestExceptionFilter,
        },
      ],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await request(app.getHttpServer()).get('/hello').send().expect(200)

    // then
    const spans = exporterSpy.mock.calls.map(call => call[0])
    expect(spans.length).toStrictEqual(4)
    expect(spans[0].name).toStrictEqual('Guard -> Global -> TestGuard')
    expect(spans[1].name).toStrictEqual('Interceptor -> Global -> TestInterceptor')
    expect(spans[2].name).toStrictEqual('Controller -> HelloController.hi')
    expect(spans[3].name).toStrictEqual('ExceptionFilter -> Global -> TestExceptionFilter')

    await app.close()
  })
})

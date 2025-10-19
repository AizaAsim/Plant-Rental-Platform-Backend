import { INestApplication } from '@nestjs/common';
import { ResponseInterceptor } from '../../core/interceptors/response.interceptor';

export default function InjectInterceptors(app: INestApplication) {
  app.useGlobalInterceptors(new ResponseInterceptor());
}

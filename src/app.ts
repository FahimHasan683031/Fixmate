import express, { Request, Response } from 'express';
import cors from 'cors';
import { StatusCodes } from 'http-status-codes';
import { Morgan } from './shared/morgan';
import router from './app/routes';
import globalErrorHandler from './app/middleware/globalErrorHandler';
import requestIp from 'request-ip';

const app = express();

app.use(Morgan.successHandler);
app.use(Morgan.errorHandler);

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestIp.mw());

app.use(express.static('uploads'));

app.use('/api/v1', router);

app.get('/', (_req: Request, res: Response) => {
  res.send('Welcome to the Backend Template!');
});

app.use(globalErrorHandler);

app.use((req: Request, res: Response) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: 'Not Found',
    errorMessages: [
      {
        path: req.originalUrl,
        message: "API DOESN'T EXIST",
      },
    ],
  });
});

export default app;

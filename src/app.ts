import express, { Express, NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
import { router as appRouter } from './api/routes/app.route';
import { router as userRoute } from './api/routes/user.route';
import { router as bookRouter } from './api/routes/book.route';
import deserializeUser from './middleware/deserializeUser';
import { cloudinaryConfig } from './config/cloudinary';

dotenv.config();

const app: Express = express();

app.use(morgan('dev'));
app.use(express.urlencoded({
  extended: false
}));
app.use(express.json());

app.use(cors({ origin: `${process.env.CLIENT_HOST_URL}` }));

app.use('*', cloudinaryConfig);

// Ensures deserializeUser middleware is called on every single route
app.use(deserializeUser);

//==== endpoint routers ====
app.use('/', appRouter);
app.use('/users', userRoute);
app.use('/books', bookRouter);
//==========================

interface Error {
  status?: number;
  message: string;
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const err: Error = new Error('Not found!');
  err.status = 404;
  next(err);
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(err.status || 500);
  res.json({
    error: {
      message: err.message
    }
  });
});

export { app };

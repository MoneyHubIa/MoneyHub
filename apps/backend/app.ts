import express from 'express';
import { createRuntimeApp } from './src/core/app/runtime-app.js';
import { firebaseAuth } from './src/modules/auth/authentication/auth.js';

firebaseAuth();

const app = express();
const api = await createRuntimeApp();
app.use(api);
app.locals.stop = api.locals.stop;

export default app;

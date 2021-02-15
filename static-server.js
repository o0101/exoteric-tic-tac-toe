// imports
  import fs from 'fs';
  import https from 'https';
  import path from 'path';

  import express from 'express';

// static express server
  const app = express();
  app.use(express.static('public'));

// start HTTPS server
  const server = https.createServer({
    key: fs.readFileSync(path.resolve('sslcerts', 'privkey.pem')),
    cert: fs.readFileSync(path.resolve('sslcerts', 'fullchain.pem')),
    ca: fs.readFileSync(path.resolve('sslcerts', 'chain.pem')),
  }, app);

  server.listen(process.env.FE_PORT || 8080, err => { 
    if ( err ) { throw err; }
    console.log(JSON.stringify({serverUp:{mode:process.env.FE_MODE, port:process.env.FE_PORT}}));
  });



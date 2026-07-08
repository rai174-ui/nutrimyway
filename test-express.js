const express = require('express');
const app = express();
const router = express.Router();
router.use('/members', (req, res, next) => {
  req.auth = 123;
  console.log('middleware ran');
  next();
});
router.param('id', (req, res, next, id) => {
  console.log('param ran, auth:', req.auth);
  if (req.auth !== Number(id)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
});
router.get('/members/:id', (req, res) => {
  res.send('ok');
});
app.use('/api', router);

const req = { url: '/api/members/123', method: 'GET' };
app.handle(req, {
  status: (s) => ({ json: (j) => console.log('status', s, j) }),
  send: (s) => console.log('send', s)
}, () => {});


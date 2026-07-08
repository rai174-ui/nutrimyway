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

app.listen(9876, async () => {
  const res = await fetch('http://localhost:9876/api/members/123');
  console.log(res.status);
  process.exit(0);
});


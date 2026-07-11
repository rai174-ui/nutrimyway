const https = require('https');

https.get('https://nutrimyway-production.up.railway.app/api/members/1/broadcasts', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(data);
  });
}).on('error', (err) => {
  console.error("Error: ", err.message);
});

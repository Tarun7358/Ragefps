const crypto = require('crypto');

function S(e) {
  e = e.toUpperCase().replace(/=+$/, '');
  let t = e.length,
      n = 0,
      r = 0,
      i = 0,
      a = new Uint8Array(t * 5 / 8 | 0);
  for (let o = 0; o < t; o++) {
    let t = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(e[o]);
    if (t !== -1) {
      r = r << 5 | t;
      n += 5;
      if (n >= 8) {
        a[i++] = r >> n - 8 & 255;
        n -= 8;
      }
    }
  }
  return Buffer.from(a);
}

const x = "RAGEOTPSECRETTSXXKEY";
const keyBytes = S(x);

function getTotp(timeStep) {
  const hmac = crypto.createHmac('sha1', keyBytes);
  const stepBytes = Buffer.alloc(8);
  stepBytes.writeBigInt64BE(BigInt(timeStep), 0);
  hmac.update(stepBytes);
  const hash = hmac.digest();
  
  const offset = hash[hash.length - 1] & 0xf;
  const binary = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);
  
  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

const now = Math.round(Date.now() / 1000);
const timeStep = Math.floor(now / 30);
console.log("Current TimeStep:", timeStep);
console.log("Generated TOTP Code:", getTotp(timeStep));
console.log("Secret bytes length:", keyBytes.length);
console.log("Secret bytes:", keyBytes.toString('hex'));

// backend/config/cloudinary.js
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const crypto = require('crypto');

// Simple Cloudinary upload without SDK dependency
async function uploadToCloudinary(filePath, folder = 'payapult') {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    // Fallback: return local path if Cloudinary not configured
    return null;
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');

  const fileBuffer = fs.readFileSync(filePath);
  const base64File = fileBuffer.toString('base64');
  const mimeType   = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const dataUri    = `data:${mimeType};base64,${base64File}`;

  const postData = new URLSearchParams({
    file:      dataUri,
    folder,
    timestamp: timestamp.toString(),
    api_key:   apiKey,
    signature,
  }).toString();

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudinary.com',
      path:     `/v1_1/${cloudName}/image/upload`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.secure_url) resolve(result.secure_url);
          else reject(new Error(result.error?.message || 'Cloudinary upload failed'));
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = { uploadToCloudinary };

const express = require('express');
const { exec } = require('child_process');
const { createHmac, randomBytes, timingSafeEqual } = require('crypto');
const app = express();
const PORT = process.env.PORT || 3001;

// Load secrets from environment variables in production
const SHARED_SECRET = process.env.WEBHOOK_SECRET || 'your_secret_token_here';
// Load deploy script path from environment variable with fallback
const DEPLOY_SCRIPT_PATH = process.env.DEPLOY_SCRIPT_PATH || '/home/ubuntu/deploy.sh';
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    // Store raw body for signature verification
    req.rawBody = buf;
  }
}));

/**
 * Validates the webhook signature from Bitbucket
 * @param {Buffer} payload - Raw request body
 * @param {string} signature - X-Hub-Signature header from Bitbucket
 * @param {string} secret - Webhook secret
 * @returns {boolean} - Whether signature is valid
 */
function validateSignature(payload, signature, secret) {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  const providedSignature = signature;
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const calculatedSignature = `sha256=${hmac.digest('hex')}`;
  
  try {
    return timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(calculatedSignature)
    );
  } catch (e) {
    console.error('Error validating signature:', e);
    return false;
  }
}

/**
 * Generates a cryptographically secure random token
 * @param {number} bytes - Number of bytes for the token
 * @returns {string} - Hex-encoded random token
 */
function generateSecureToken(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

// Endpoint for generating a new webhook secret
app.get('/generate-secret', (req, res) => {
  // In production, this should be protected with authentication
//   const apiKey = req.headers['x-api-key'];
//   if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
//     return res.status(401).json({ error: 'Unauthorized' });
//   }
  
  const newSecret = generateSecureToken();
  res.json({ 
    secret: newSecret,
    message: 'Store this secret securely. It will not be displayed again.'
  });
});

// Main webhook endpoint for Bitbucket deployments
app.post('/bitbucket-deploy', (req, res) => {
  // Validate the signature from Bitbucket
  const signature = req.headers['x-hub-signature'];
  
  if (!validateSignature(req.rawBody, signature, SHARED_SECRET)) {
    console.log('Invalid signature received');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Extract repository and branch information
  const repoFullName = req.body.repository?.full_name;
  const branch = req.body.push?.changes?.[0]?.new?.name;
  
  if (!repoFullName || !branch) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }
  
  // Project configuration mapping
  const CONFIG = {
    'your-team/your-repo': {
      path: '/var/www/your-next-app',
      process: 'next-app',
    },
    'your-team/staging-repo': {
      path: '/var/www/next-staging',
      process: 'next-staging',
    },
  };
  
  const project = CONFIG[repoFullName];
  if (!project) {
    return res.status(400).json({ error: 'Repository not configured for deployment' });
  }
  
  const { path, process } = project;
  
  // Log the deployment attempt
  console.log(`Deploying ${repoFullName} (${branch}) to ${path}`);
  
  // Execute deployment script
  const deployScript = `/home/ubuntu/deploy.sh "${path}" "${branch}" "${process}"`;
  
  exec(deployScript, (err, stdout, stderr) => {
    if (err) {
      console.error('Deployment error:', stderr);
      return res.status(500).json({ 
        error: 'Deployment failed',
        details: stderr
      });
    }
    
    console.log('Deployment successful:', stdout);
    res.json({ 
      status: 'success',
      message: 'Deployment completed successfully',
      details: stdout
    });
  });
});

// Add a test endpoint to verify the server is running
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Bitbucket deploy webhook server running on port ${PORT}`);
});
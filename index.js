const express = require('express');
const { exec } = require('child_process');
const { createHmac, randomBytes, timingSafeEqual } = require('crypto');
const app = express();
require('dotenv').config();
const PORT = process.env.PORT || 9898;

// Load secrets from environment variables in production
const SHARED_SECRET = process.env.WEBHOOK_SECRET;

// Load deploy script path from environment variable with fallback
const DEPLOY_SCRIPT_PATH = process.env.DEPLOY_SCRIPT_PATH || '/home/ubuntu/deploy.sh';
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    // Store raw body for signature verification
    req.rawBody = buf;
  }
}));

// Main webhook endpoint for Bitbucket deployments
app.post('/webhook', (req, res) => {


  // Validate the signature from Bitbucket
  const signature = req.headers['x-hub-signature'];
  
  if (!validateSignature(req.rawBody, signature, SHARED_SECRET)) {
    console.log('Invalid signature received');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  const eventKey = req.headers['x-event-key'];
  // Extract repository and branch information
  const repoFullName = req.body.repository?.full_name;
//  const branch = req.body.push?.changes?.[0]?.new?.name;
  
  if (!repoFullName) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }
  
  // Project configuration mapping
  const CONFIG = {
    'Eytsam786/drmashroombackend': {
      path: '/var/www/deployed/staging/drmashroombackend',
      process: 'nest-app-backend',
      isBackend: true,
    },
    'Eytsam786/drmashroomfe-admin': {
      path: '/var/www/deployed/staging/drmashroomfe-admin',
      process: 'Admin-frontend',
      isBackend: false,
    },
    'Eytsam786/drmashroomfrontend': {
      path: '/var/www/deployed/staging/drmashroomfrontend',
      process: 'studentfronted',
      isBackend: false,
    }
  };
  
  const project = CONFIG[repoFullName];
  if (!project) {
    return res.status(400).json({ error: 'Repository not configured for deployment' });
  }
  
  const { path, process } = project;
    let shouldDeploy = false;

  if (eventKey === 'repo:push') {
    const branch = req.body.push?.changes?.[0]?.new?.name;
    if (branch === 'staging') {
      shouldDeploy = true;
    }
  } else if (eventKey === 'pullrequest:fulfilled') {
    const destBranch = req.body.pullrequest?.destination?.branch?.name;
    if (destBranch === 'staging') {
      shouldDeploy = true;
    }
  }
if (!shouldDeploy) {
    return res.status(200).json({ message: 'Event ignored: not targeting staging' });
  }
  // Log the deployment attempt
  console.log(`Deploying ${repoFullName} to ${path}`);
  
  // Execute deployment script
  const deployScript = `${DEPLOY_SCRIPT_PATH} "${path}" "staging" "${process}" ${project.isBackend}`;

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

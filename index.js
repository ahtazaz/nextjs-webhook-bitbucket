const express = require('express');
const bodyParser = require('body-parser');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createHmac, randomBytes, timingSafeEqual } = require('crypto');
const app = express();
require('dotenv').config();
app.use(bodyParser.json());

const PORT = 9898;
const LOG_FILE = path.join(__dirname, 'webhook.log');
const locks = {}; // project-wise lock

function log(message) {
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] ${message}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, msg + '\n');
}


const PROJECTS = {
  'Eytsam786/drmashroombackend': {
    dir: '/var/www/deployed/staging/drmashroombackend',
    pm2: 'backend',
  },
 'Eytsam786/drmashroomfe-admin': {
  path: '/var/www/deployed/staging/drmashroomfe-admin',
    pm2: 'frontend-dev',
  },
  'Eytsam786/drmashroomfrontend': {
    dir:'/var/www/deployed/staging/drmashroomfrontend',
    pm2: 'student-fronted',
  },
};
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
app.post('/webhook', async (req, res) => {
    // Validate the signature from Bitbucket
    const signature = req.headers['x-hub-signature'];
  
    if (!validateSignature(req.rawBody, signature, SHARED_SECRET)) {
      console.log('Invalid signature received');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  const event = req.headers['x-event-key'];
  const body = req.body;

  if (!body || !body.repository || !body.push) {
    return res.status(400).send('Invalid payload');
  }

  const repoName = body.repository.full_name;
  const project = PROJECTS[repoName];

  if (!project) {
    return res.status(200).send('Repo not configured.');
  }

  const changes = body.push.changes || [];
  const relevant = changes.find(c => c.new?.name === 'staging');

  if (!relevant) {
    return res.status(200).send('No staging branch changes detected.');
  }

  // Lock to prevent overlapping deployments
  if (locks[repoName]) {
    log(`Deployment already in progress for ${repoName}. Skipping.`);
    return res.status(200).send('Deployment already in progress.');
  }

  locks[repoName] = true;

  try {
    const commits = relevant.commits || [];
    const packageChanged = commits.some(commit =>
      commit.files?.some(f => f.path === 'package.json')
    );

    log(`Deploying ${repoName} to staging...`);
    process.chdir(project.dir);

    log(`Pulling latest code`);
    execSync(`git pull origin staging`, { stdio: 'inherit' });

    if (packageChanged) {
      log(`package.json changed. Installing & building...`);
      execSync('npm ci', { stdio: 'inherit' });
      execSync('npm run build', { stdio: 'inherit' });
    } else {
      log(`package.json unchanged. Skipping install and building.`);
      execSync('npm run build', { stdio: 'inherit' });
    }

    log(`Restarting PM2 process: ${project.pm2}`);
    execSync(`pm2 restart ${project.pm2}`, { stdio: 'inherit' });

    log(`✅ Deployed ${repoName} successfully.`);
    res.status(200).send('Deployment complete.');
  } catch (err) {
    log(`❌ Deployment failed for ${repoName}: ${err.message}`);
    res.status(500).send('Deployment failed.');
  } finally {
    locks[repoName] = false;
  }
});

app.listen(PORT, () => {
  log(`🚀 Webhook listening on port ${PORT}`);
});

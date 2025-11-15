
/**
 * @fileoverview This script automatically adds the current application's domain
 * (from `process.env.NEXT_PUBLIC_APP_URL`) to the Firebase Authentication authorized domains list.
 * This is crucial for enabling social sign-in (Google, Apple, etc.) to work in ephemeral
 * development environments like Cloud Workstations.
 */

// Load environment variables from .env file
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });

import { authAdmin } from '@/firebase/admin';
import fetch from 'node-fetch';

/**
 * Fetches an OAuth2 access token for the service account to authenticate with Firebase APIs.
 * @returns {Promise<string>} The access token.
 */
async function getAccessToken(): Promise<string> {
  const app = authAdmin.app;
  const credential = app.options.credential;

  if (!credential) {
    throw new Error('Firebase Admin credential not found. Ensure the SDK is initialized correctly.');
  }

  // Check if the credential has the getAccessToken method
  if ('getAccessToken' in credential) {
    const accessToken = await credential.getAccessToken();
    if (accessToken?.access_token) {
      return accessToken.access_token;
    }
  }
  
  throw new Error('Could not retrieve access token from Firebase Admin credential.');
}

/**
 * Main function to run the domain authorization process.
 */
async function addDomainToFirebaseAuth() {
  const domainUrl = process.env.NEXT_PUBLIC_APP_URL;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!domainUrl) {
    console.error('❌ Error: `NEXT_PUBLIC_APP_URL` is not set in your environment variables.');
    console.log('   Please add it to your .env file (e.g., NEXT_PUBLIC_APP_URL=https://your-workstation-url.app).');
    process.exit(1);
  }

  if (!projectId) {
    console.error('❌ Error: `FIREBASE_PROJECT_ID` is not set. Please check your environment variables.');
    process.exit(1);
  }

  // Extract the hostname from the full URL
  const domain = new URL(domainUrl).hostname;
  console.log(`🚀 Starting process for domain: ${domain}`);

  try {
    const accessToken = await getAccessToken();
    const configUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/config`;

    // 1. Fetch the current configuration
    const getConfigResponse = await fetch(configUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!getConfigResponse.ok) {
      throw new Error(`Failed to fetch current Firebase Auth config. Status: ${getConfigResponse.status}`);
    }

    const currentConfig = await getConfigResponse.json() as { authorizedDomains?: string[] };
    const authorizedDomains = currentConfig.authorizedDomains || [];

    // 2. Check if the domain already exists
    if (authorizedDomains.includes(domain)) {
      console.log(`✅ Domain "${domain}" already exists in the Firebase Auth authorized domains list. No action needed.`);
      return;
    }

    // 3. If not, add the new domain and update the config
    console.log(`🔧 Domain "${domain}" not found. Attempting to add it...`);
    const updatedDomains = [...authorizedDomains, domain];

    const updateConfigResponse = await fetch(`${configUrl}?updateMask=authorizedDomains`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorizedDomains: updatedDomains,
      }),
    });

    if (!updateConfigResponse.ok) {
        const errorBody = await updateConfigResponse.text();
        throw new Error(`Failed to update Firebase Auth config. Status: ${updateConfigResponse.status}, Body: ${errorBody}`);
    }

    console.log(`🎉 Successfully added domain "${domain}" to the Firebase Auth authorized domains list!`);

  } catch (error: any) {
    console.error('❌ An error occurred during the domain authorization process:', error.message);
    process.exit(1);
  }
}

addDomainToFirebaseAuth();

const express = require('express');
const fetch = require('node-fetch'); // Use node-fetch to make HTTP requests
const cors = require('cors'); // Import the CORS package
const app = express();
const port = 3000;

// Use CORS middleware to allow requests from any origin
app.use(cors());
app.use(express.json()); // Middleware to parse JSON request bodies

// Zoho OAuth token URL and credentials
const tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';
const clientId = '1000.CTGP3YZAZ1V7ZM0ICIUH22BEDTN7DP';
const clientSecret = '4f1ae6f1ba26abe6d952c3f3dfae7c940a3a5f76bd';
const refreshToken = '1000.341c4e2f5f3e05f05e174faf87c25a75.920ea1ddfeee06ca0beee12ee5b51123'; // Refresh token

// Variable to store the current access token
let currentAccessToken = null;

// Function to get a new access token using the refresh token
async function refreshAccessToken() {
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Error refreshing token: ${response.statusText}`);
    }

    const data = await response.json();
    currentAccessToken = data.access_token; // Set the new access token
    console.log('New access token obtained:', currentAccessToken);
  } catch (error) {
    console.error('Error refreshing token:', error.message);
    throw error; // If token refresh fails, throw error
  }
}

// Function to make the Zoho API request
async function getZohoCandidateData(email) {
  const url = `https://recruit.zoho.com/recruit/v2/Candidates/search?email=${email}`;

  // If there is no access token, refresh it
  if (!currentAccessToken) {
    console.log('No access token found. Refreshing token...');
    await refreshAccessToken();
  }

  const headers = {
    'Authorization': `Zoho-oauthtoken ${currentAccessToken}`,
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error:', errorData.message);
      if (response.status === 401 && errorData.code === 'INVALID_TOKEN') {
        console.log('Token expired, refreshing...');

        try {
          // Refresh the token and retry the API request
          await refreshAccessToken(); // Refresh token first

          // Retry with the new token
          const retryResponse = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Zoho-oauthtoken ${currentAccessToken}`,
              'Content-Type': 'application/json',
            },
          });

          const retryData = await retryResponse.json();
          console.log('Retry Response:', retryData);
          return retryData;
        } catch (refreshError) {
          console.error('Error retrying request with new token:', refreshError.message);
          throw refreshError;
        }
      }
    } else {
      const data = await response.json();
      console.log('Response:', data);
      return data;
    }
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Function to create a new candidate in Zoho Recruit
async function createZohoCandidate(candidateData) {
  const url = `https://recruit.zoho.com/recruit/v2/Candidates`;

  // If there is no access token, refresh it
  if (!currentAccessToken) {
    console.log('No access token found. Refreshing token...');
    await refreshAccessToken();
  }

  const headers = {
    'Authorization': `Zoho-oauthtoken ${currentAccessToken}`,
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data: [candidateData] }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error:', errorData.message);
      if (response.status === 401 && errorData.code === 'INVALID_TOKEN') {
        console.log('Token expired, refreshing...');

        try {
          // Refresh the token and retry the API request
          await refreshAccessToken(); // Refresh token first

          // Retry with the new token
          const retryResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Zoho-oauthtoken ${currentAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: [candidateData] }),
          });

          const retryData = await retryResponse.json();
          console.log('Retry Response:', retryData);
          return retryData;
        } catch (refreshError) {
          console.error('Error retrying request with new token:', refreshError.message);
          throw refreshError;
        }
      }
    } else {
      const data = await response.json();
      console.log('Response:', data);
      return data;
    }
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Endpoint to create a new candidate
app.post('/create-candidate', async (req, res) => {
  const candidateData = req.body;

  if (!candidateData || Object.keys(candidateData).length === 0) {
    return res.status(400).json({ error: 'Candidate data is required.' });
  }

  try {
    const apiResponse = await createZohoCandidate(candidateData);
    return res.json(apiResponse);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create candidate.', details: error.message });
  }
});

// Define an endpoint to fetch candidate data (existing functionality)
app.get('/fetch-candidate', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email query parameter is required.' });
  }

  try {
    const candidateData = await getZohoCandidateData(email);
    return res.json(candidateData);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch candidate data.', details: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

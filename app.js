const express = require('express');
const fetch = require('node-fetch'); // Use node-fetch to make HTTP requests
const cors = require('cors'); // Import the CORS package
const app = express();
const port = 3000;
const FormData = require('form-data');
const multer = require('multer');
// Set up multer to handle the file upload
const storage = multer.memoryStorage(); // Use memory storage for simplicity
const upload = multer({ storage: storage });

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
async function getZohoCandidateData(computrabajo_candidate_id) {
  const url = `https://recruit.zoho.com/recruit/v2/Candidates/search?criteria=(computrabajo_candidate_id:equals:${computrabajo_candidate_id})`;

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

// Function to download the photo from Zoho Recruit
async function downloadCandidatePhotoFromZoho(candidateId) {
  const url = `https://recruit.zoho.com/recruit/v2/Candidates/${candidateId}/photo`;

  if (!currentAccessToken) {
    console.log('No access token found. Refreshing token...');
    await refreshAccessToken();
  }

  const headers = {
    'Authorization': `Zoho-oauthtoken ${currentAccessToken}`,
  };

  try {
    // Send the photo download request to Zoho Recruit
    const photoResponse = await fetch(url, {
      method: 'GET',
      headers: headers,
    });

    if (!photoResponse.ok) {
      const errorData = await photoResponse.json();
      console.error('Error downloading photo:', errorData);
      throw new Error(`Photo download failed: ${errorData.message}`);
    }

    // Log the response headers and check content type
    const contentType = photoResponse.headers.get('Content-Type');
    console.log('Content-Type:', contentType);  // Log content type for debugging
    console.log('Content-Length:', photoResponse.headers.get('Content-Length')); // Log response size

    // Ensure the response is an image
    if (!contentType.startsWith('image/')) {
      throw new Error('The downloaded file is not an image.');
    }

    // Convert the response to a Blob (image data)
    const photoBlob = await photoResponse.blob();
    console.log('Downloaded photo size:', photoBlob.size);  // Log the photo size

    // Ensure the Blob is not empty
    if (photoBlob.size === 0) {
      throw new Error('Downloaded photo is empty.');
    }

    return photoBlob;
  } catch (error) {
    console.error('Error in downloadCandidatePhotoFromZoho:', error.message);
    throw error;
  }
}

app.get('/download-photo', async (req, res) => {
  const { candidateId } = req.query;  // Candidate ID from query params

  if (!candidateId) {
    return res.status(400).json({ error: 'Candidate ID is required.' });
  }

  try {
    const photoBlob = await downloadCandidatePhotoFromZoho(candidateId);

    // Ensure the Content-Type is set correctly without charset
    const contentType = 'image/jpeg';  // Adjust based on the actual image type
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'attachment; filename="candidate_photo.jpeg"');  // Modify if necessary

    // Check the photo size before sending
    console.log('Sending photo of size:', photoBlob.size);

    // Set the proper content length
    res.setHeader('Content-Length', photoBlob.size);  // Add Content-Length header explicitly

    // Send the photo as a stream
    const stream = photoBlob.stream();  // Create a readable stream from the Blob
    stream.pipe(res);  // Pipe the stream to the response

  } catch (error) {
    console.error('Error in /download-photo:', error.message);
    res.status(500).json({ error: 'Failed to download photo.', details: error.message });
  }
});






// Function to upload the photo to Zoho Recruit
async function uploadCandidatePhotoToZoho(candidateId, photoBlob) {
  const url = `https://recruit.zoho.com/recruit/v2/Candidates/${candidateId}/photo`;

  // If there is no access token, refresh it
  if (!currentAccessToken) {
    console.log('No access token found. Refreshing token...');
    await refreshAccessToken();
  }

  // Create a FormData object and append the file
  const formData = new FormData();
  formData.append('file', photoBlob, 'candidate_photo.jpeg'); // Correct file format expected by Zoho

  const headers = {
    'Authorization': `Zoho-oauthtoken ${currentAccessToken}`,
  };

  try {
    // Send the photo upload request to Zoho Recruit
    const photoResponse = await fetch(url, {
      method: 'POST',
      headers: headers, // Pass headers without 'Content-Type'
      body: formData,   // Send the FormData object directly as the body
    });

    if (!photoResponse.ok) {
      const errorData = await photoResponse.json();
      console.error('Error uploading photo:', errorData);
      throw new Error(`Photo upload failed: ${errorData.message}`);
    }

    const photoData = await photoResponse.json();
    console.log('Photo upload successful:', photoData);
    return photoData;

  } catch (error) {
    console.error('Error in uploadCandidatePhotoToZoho:', error.message);
    throw error;
  }
}

// Endpoint to receive photo and candidateId from the client
// Use 'upload.single' to handle a single file upload with the field name 'file'
app.post('/upload-photo', upload.single('file'), async (req, res) => {
  const { candidateId } = req.body;  // Candidate ID comes from form data (not JSON)
  const photoBlob = req.file.buffer; // The uploaded file will be stored in req.file.buffer by multer

  if (!candidateId || !photoBlob) {
    return res.status(400).json({ error: 'Candidate ID and photo file are required.' });
  }

  try {
    // Upload the photo to Zoho Recruit
    const uploadResponse = await uploadCandidatePhotoToZoho(candidateId, photoBlob);
    res.json({ success: true, message: 'Photo uploaded successfully.', data: uploadResponse });

  } catch (error) {
    res.status(500).json({ error: 'Failed to upload photo.', details: error.message });
  }
});


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

app.get('/fetch-candidate', async (req, res) => {
  const { computrabajo_candidate_id } = req.query;

  if (!computrabajo_candidate_id) {
    return res.status(400).json({ error: 'computrabajo_candidate_id query parameter is required.' });
  }

  try {
    const candidateData = await getZohoCandidateData(computrabajo_candidate_id);
    return res.json(candidateData);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch candidate data.', details: error.message });
  }
});

// Define an endpoint to fetch applications related to a candidate
app.get('/fetch-related-applications', async (req, res) => {
  const { candidateId } = req.query;

  if (!candidateId) {
    return res.status(400).json({ error: 'Candidate ID query parameter is required.' });
  }

  try {
    const applicationData = await getRelatedApplications(candidateId);
    return res.json(applicationData);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch related applications.', details: error.message });
  }
});
  
// Function to fetch related applications for a candidate
async function getRelatedApplications(candidateId) {
  const moduleApiName = "Candidates"; // The module from which you're fetching related records
  const relatedModule = "Applications"; // The related module (Applications)
  const url = `https://recruit.zoho.com/recruit/v2/${moduleApiName}/${candidateId}/${relatedModule}`;

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
        await refreshAccessToken();

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
      }

      throw new Error(errorData.message);
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

// Define an endpoint to fetch application data
app.get('/fetch-application', async (req, res) => {
  const { candidateId } = req.query;

  if (!candidateId) {
    return res.status(400).json({ error: 'Candidate ID query parameter is required.' });
  }

  try {
    const applicationData = await getZohoApplicationData(candidateId);
    return res.json(applicationData);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch application data.', details: error.message });
  }
});

// Function to create a new job opening in Zoho Recruit
async function createZohoJobOpening(jobOpeningData) {
  const url = `https://recruit.zoho.com/recruit/v2/JobOpenings`;

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
      body: JSON.stringify({ data: [jobOpeningData] }),
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
            body: JSON.stringify({ data: [jobOpeningData] }),
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


// Endpoint to create a new job opening
app.post('/create-job-opening', async (req, res) => {
  const jobOpeningData = req.body;

  if (!jobOpeningData || Object.keys(jobOpeningData).length === 0) {
    return res.status(400).json({ error: 'Job opening data is required.' });
  }

  try {
    const apiResponse = await createZohoJobOpening(jobOpeningData);
    return res.json(apiResponse);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create job opening.', details: error.message });
  }
});

app.get('/fetch-job-opening', async (req, res) => {
  const { computrabajo_oi } = req.query;

  if (!computrabajo_oi) {
    return res.status(400).json({ error: 'computrabajo_oi query parameter is required.' });
  }

  try {
    const jobOpeningData = await getZohoJobOpeningData(computrabajo_oi);
    return res.json(jobOpeningData);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch job opening data.', details: error.message });
  }
});


// Function to make the Zoho API request for JobOpenings
async function getZohoJobOpeningData(computrabajoOi) {
  const url = `https://recruit.zoho.com/recruit/v2/JobOpenings/search?criteria=(computrabajo_oi:equals:${computrabajoOi})`;

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

// Route to associate a candidate with a job opening
app.put('/associate-candidate', async (req, res) => {
  const { jobIds, candidateIds, comments } = req.body;

  // Validate input
  if (!jobIds || !candidateIds || jobIds.length === 0 || candidateIds.length === 0) {
    return res.status(400).json({ error: 'Job IDs and Candidate IDs are required.' });
  }

  try {
    const associationResponse = await associateCandidateWithJob(jobIds, candidateIds, comments);
    return res.json(associationResponse);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to associate candidate with job opening.', details: error.message });
  }
});

// Function to make the Zoho API request for association
async function associateCandidateWithJob(jobIds, candidateIds, comments = 'Record successfully associated') {
  const url = `https://recruit.zoho.com/recruit/v2/Candidates/actions/associate`;

  // If there is no access token, refresh it
  if (!currentAccessToken) {
    console.log('No access token found. Refreshing token...');
    await refreshAccessToken();
  }

  const headers = {
    'Authorization': `Zoho-oauthtoken ${currentAccessToken}`,
    'Content-Type': 'application/json',
  };

  const payload = {
    data: [
      {
        jobids: jobIds,
        ids: candidateIds,
        comments,
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error associating candidate:', errorData.message);
      throw new Error(errorData.message);
    }

    const data = await response.json();
    console.log('Candidate successfully associated:', data);
    return data;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Backend Route: Update Application
app.put('/update-application', async (req, res) => {
  const { applicationId, updates } = req.body;

  if (!applicationId || !updates) {
    return res.status(400).json({ error: 'applicationId and updates are required.' });
  }

  try {
    const response = await updateZohoApplication(applicationId, updates);
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update application.', details: error.message });
  }
});

// Function to send the update request to Zoho Recruit API
async function updateZohoApplication(applicationId, updates) {
  const url = `https://recruit.zoho.com/recruit/v2/Applications/${applicationId}`;

  // Refresh access token if needed
  if (!currentAccessToken) {
    console.log('No access token found. Refreshing token...');
    await refreshAccessToken();
  }

  const headers = {
    'Authorization': `Zoho-oauthtoken ${currentAccessToken}`,
    'Content-Type': 'application/json',
  };

  const payload = {
    data: [
      {
        ...updates,
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error:', errorData.message);
      throw new Error(`Zoho API Error: ${errorData.message}`);
    }

    const data = await response.json();
    console.log('Application Updated:', data);
    return data;
  } catch (error) {
    console.error('Error updating application:', error.message);
    throw error;
  }
}

// Backend Route: Update Candidate
app.put('/update-candidate', async (req, res) => {
  const { candidateId, updates } = req.body;

  if (!candidateId || !updates) {
    return res.status(400).json({ error: 'candidateId and updates are required.' });
  }

  try {
    const response = await updateZohoCandidate(candidateId, updates);
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update candidate.', details: error.message });
  }
});

// Function to send the update request to Zoho Recruit API
async function updateZohoCandidate(candidateId, updates) {
  const url = `https://recruit.zoho.com/recruit/v2/Candidates/${candidateId}`;

  // Refresh access token if needed
  if (!currentAccessToken) {
    console.log('No access token found. Refreshing token...');
    await refreshAccessToken();
  }

  const headers = {
    'Authorization': `Zoho-oauthtoken ${currentAccessToken}`,
    'Content-Type': 'application/json',
  };

  const payload = {
    data: [
      {
        ...updates,
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error:', errorData.message);
      throw new Error(`Zoho API Error: ${errorData.message}`);
    }

    const data = await response.json();
    console.log('Candidate Updated:', data);
    return data;
  } catch (error) {
    console.error('Error updating candidate:', error.message);
    throw error;
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

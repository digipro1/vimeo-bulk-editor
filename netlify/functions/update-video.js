const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // 1. Authenticate the user
  const { user } = context.clientContext;
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'You must be logged in to edit videos.' }),
    };
  }

  // 2. Check if this is a PATCH request
  if (event.httpMethod !== 'PATCH') {
    return {
      statusCode: 405, // Method Not Allowed
      body: JSON.stringify({ error: 'Only PATCH requests are allowed.' }),
    };
  }

  // 3. Get the video ID and new data from the request
  const { VIMEO_API_TOKEN } = process.env;
  const { videoId, updates } = JSON.parse(event.body);

  if (!videoId || !updates) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing video ID or update data.' }),
    };
  }

  const API_ENDPOINT = `https://api.vimeo.com/videos/${videoId}`;

  // 4. Send the update to the Vimeo API
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${VIMEO_API_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Vimeo API Error:', errorData);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Failed to update video on Vimeo.' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Video updated successfully.' }),
    };

  } catch (error) {
    console.error('Internal Server Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An internal error occurred.' }),
    };
  }
};

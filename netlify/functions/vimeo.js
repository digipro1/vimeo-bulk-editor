const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const { VIMEO_API_TOKEN } = process.env;
  // The endpoint to get all videos for the authenticated user.
  const API_ENDPOINT = 'https://api.vimeo.com/me/videos?fields=uri,name,description,tags,parent_folder';

  // Check if the token is available
  if (!VIMEO_API_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Vimeo API token is not configured.' }),
    };
  }

  try {
    const response = await fetch(API_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${VIMEO_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Failed to fetch videos from Vimeo.' }),
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

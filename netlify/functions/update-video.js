const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const { user } = context.clientContext;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'You must be logged in.' }) };
  }

  if (event.httpMethod !== 'PATCH') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Only PATCH requests are allowed.' }) };
  }

  const { VIMEO_API_TOKEN } = process.env;
  const { videoId, updates } = JSON.parse(event.body);

  if (!videoId || !updates) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing video ID or update data.' }) };
  }

  const baseHeaders = {
    Authorization: `Bearer ${VIMEO_API_TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.vimeo.*+json;version=3.4',
  };

  try {
    // --- NEW LOGIC STARTS HERE ---

    // 1. Check for and handle tag updates separately and first.
    if (updates.tags && Array.isArray(updates.tags)) {
      const tagsEndpoint = `https://api.vimeo.com/videos/${videoId}/tags`;
      const tagsResponse = await fetch(tagsEndpoint, {
        method: 'PUT', // The dedicated endpoint uses PUT to replace all tags
        headers: baseHeaders,
        body: JSON.stringify(updates.tags),
      });

      if (!tagsResponse.ok) {
        // If updating tags fails, log it but don't stop other updates.
        console.error('Vimeo API Error (Tags):', await tagsResponse.json());
      }

      // Remove tags from the main update object so they aren't sent twice.
      delete updates.tags;
    }

    // 2. Check if there are any other updates to process.
    // We check if other keys besides 'tags' (which we just deleted) exist.
    if (Object.keys(updates).length > 0) {
      const metadataEndpoint = `https://api.vimeo.com/videos/${videoId}`;
      const metadataResponse = await fetch(metadataEndpoint, {
        method: 'PATCH',
        headers: baseHeaders,
        body: JSON.stringify(updates),
      });

      if (!metadataResponse.ok) {
        // If metadata updates fail, throw an error.
        const errorData = await metadataResponse.json();
        console.error('Vimeo API Error (Metadata):', errorData);
        throw new Error('Failed to update video metadata on Vimeo.');
      }
    }
    
    // --- NEW LOGIC ENDS HERE ---

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Video updated successfully.' }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'An internal error occurred.' }),
    };
  }
};

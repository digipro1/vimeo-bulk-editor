const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    const { user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'You must be logged in.' }) };
    }

    // Get the video ID from the request URL
    const { videoId } = event.queryStringParameters;
    if (!videoId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'A video ID must be provided.' }) };
    }

    const { VIMEO_API_TOKEN } = process.env;
    // This is the specific Vimeo API endpoint for text tracks (captions)
    const API_ENDPOINT = `https://api.vimeo.com/videos/${videoId}/texttracks`;

    try {
        const response = await fetch(API_ENDPOINT, {
            headers: { Authorization: `Bearer ${VIMEO_API_TOKEN}` },
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Vimeo API Error:', errorData);
            throw new Error('Failed to fetch text tracks from Vimeo.');
        }

        const data = await response.json();

        // Return the list of available caption tracks
        return {
            statusCode: 200,
            body: JSON.stringify(data.data), // The tracks are in the 'data' property
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

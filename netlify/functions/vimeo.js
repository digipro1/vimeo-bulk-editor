const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    const { user } = context.clientContext;
    if (!user) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'You must be logged in.' }),
        };
    }

    const { VIMEO_API_TOKEN } = process.env;
    // Get the requested fields from the query string, with defaults
    const params = new URLSearchParams(event.queryStringParameters);
    const fields = params.get('fields') || 'uri,name,description,tags,status,parent_folder';

    let allVideos = [];
    let nextPageUrl = `https://api.vimeo.com/me/videos?fields=${fields}&per_page=100`; // Start with 100 per page
    let safetyCounter = 0; // Prevents accidental infinite loops

    try {
        // Loop while there's a next page URL and we haven't hit our safety limit
        while (nextPageUrl && safetyCounter < 50) {
            const response = await fetch(nextPageUrl, {
                headers: { Authorization: `Bearer ${VIMEO_API_TOKEN}` },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch videos from Vimeo.');
            }

            const pageData = await response.json();
            allVideos = allVideos.concat(pageData.data); // Add the videos from this page to our list
            nextPageUrl = pageData.paging.next; // Get the URL for the next page
            safetyCounter++;
        }

        return {
            statusCode: 200,
            // We wrap our results in a 'data' object to match the original structure
            body: JSON.stringify({ data: allVideos }),
        };

    } catch (error) {
        console.error('Vimeo fetch error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

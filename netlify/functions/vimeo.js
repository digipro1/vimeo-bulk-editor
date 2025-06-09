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
    const params = new URLSearchParams(event.queryStringParameters);
    const fields = params.get('fields') || 'uri,name,description,tags,status,parent_folder';
    
    let allVideos = [];
    // The initial URL is absolute, which is correct.
    let nextUrl = `https://api.vimeo.com/me/videos?fields=${fields}&per_page=100`;
    let safetyCounter = 0;

    try {
        // Loop while there's a next page URL and we haven't hit our safety limit
        while (nextUrl && safetyCounter < 50) {
            const response = await fetch(nextUrl, { // On first loop, this is the full URL
                headers: { Authorization: `Bearer ${VIMEO_API_TOKEN}` },
            });

            if (!response.ok) {
                console.error("Vimeo API Error Response:", await response.text());
                throw new Error('Failed to fetch videos from Vimeo.');
            }

            const pageData = await response.json();
            allVideos = allVideos.concat(pageData.data);

            // --- THIS IS THE FIX ---
            // Check if the 'next' paging link exists and construct an absolute URL if it does.
            if (pageData.paging && pageData.paging.next) {
                nextUrl = `https://api.vimeo.com${pageData.paging.next}`;
            } else {
                nextUrl = null; // No more pages, so we stop the loop.
            }
            
            safetyCounter++;
        }

        return {
            statusCode: 200,
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

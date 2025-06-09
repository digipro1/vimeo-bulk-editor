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
    const folderUri = params.get('folderUri');

    if (!folderUri) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'A folder URI must be provided.' }),
        };
    }

    // The new endpoint gets items from a specific folder.
    const fields = 'uri,name,description,tags,status,parent_folder';
    const initialUrl = `https://api.vimeo.com${folderUri}/videos?fields=${fields}&per_page=100`;

    // The rest of the function is the same pagination logic as before
    let allVideos = [];
    let nextUrl = initialUrl;

    try {
        while (nextUrl) {
            const response = await fetch(nextUrl, {
                headers: { Authorization: `Bearer ${VIMEO_API_TOKEN}` },
            });

            if (!response.ok) throw new Error('Failed to fetch videos from Vimeo.');

            const pageData = await response.json();
            allVideos = allVideos.concat(pageData.data);

            nextUrl = pageData.paging && pageData.paging.next
                ? `https://api.vimeo.com${pageData.paging.next}`
                : null;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ data: allVideos }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

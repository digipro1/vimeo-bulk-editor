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
    // 'page' will be the path for the next page, e.g., "/me/videos?page=2"
    const page = params.get('page'); 

    // If a 'page' path is provided, use it. Otherwise, use the initial URL.
    const initialUrl = `https://api.vimeo.com/me/videos?fields=uri,name,description,tags,status,parent_folder&per_page=100`;
    const fetchUrl = page ? `https://api.vimeo.com${page}` : initialUrl;

    try {
        const response = await fetch(fetchUrl, {
            headers: { Authorization: `Bearer ${VIMEO_API_TOKEN}` },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch a page from Vimeo.');
        }

        const responseData = await response.json();

        // Return this page's data AND the path to the next page
        return {
            statusCode: 200,
            body: JSON.stringify({
                data: responseData.data,
                nextPagePath: responseData.paging ? responseData.paging.next : null,
            }),
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

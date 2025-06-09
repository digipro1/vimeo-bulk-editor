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
    // This endpoint specifically gets folders (also called projects)
    const API_ENDPOINT = 'https://api.vimeo.com/me/projects?fields=uri,name&per_page=100';
    let allFolders = [];
    let nextUrl = API_ENDPOINT;

    try {
        while (nextUrl) {
            const response = await fetch(nextUrl, {
                headers: { Authorization: `Bearer ${VIMEO_API_TOKEN}` },
            });

            if (!response.ok) throw new Error('Failed to fetch folders from Vimeo.');

            const pageData = await response.json();
            allFolders = allFolders.concat(pageData.data);

            nextUrl = pageData.paging && pageData.paging.next
                ? `https://api.vimeo.com${pageData.paging.next}`
                : null;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ folders: allFolders }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    const { user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'You must be logged in.' }) };
    }

    const { VIMEO_API_TOKEN } = process.env;
    
    // Default to the first page of projects, fetching up to 100 at a time
    const page = event.queryStringParameters.page || '/me/projects?per_page=100';
    const API_ENDPOINT = page.startsWith('http') ? page : `https://api.vimeo.com${page}`;

    try {
        const response = await fetch(API_ENDPOINT, {
            headers: { Authorization: `Bearer ${VIMEO_API_TOKEN}` }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch folders: ${response.statusText}`);
        }

        const data = await response.json();

        // We return the FULL data.data array here so the frontend receives 
        // the metadata.connections.parent_folder needed to build the tree.
        return {
            statusCode: 200,
            body: JSON.stringify({
                folders: data.data,
                nextPagePath: data.paging.next
            })
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

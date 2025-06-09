const appContainer = document.getElementById('app-container');
const videoList = document.getElementById('video-list');

// Function to fetch and display videos
const fetchVideos = async (user) => {
    // Show loading state
    videoList.innerHTML = '<p>Loading videos...</p>';

    try {
        const response = await fetch('/api/vimeo', {
            headers: {
                // Send the authentication token to the serverless function
                Authorization: `Bearer ${user.token.access_token}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch videos.');
        }

        const data = await response.json();
        renderVideos(data);

    } catch (error) {
        console.error('Error fetching videos:', error);
        videoList.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
};

// Function to render the video data to the page
const renderVideos = (data) => {
    // Clear the loading message
    videoList.innerHTML = '';

    if (!data.data || data.data.length === 0) {
        videoList.innerHTML = '<p>No videos found in this account.</p>';
        return;
    }

    const videosByFolder = {};
    data.data.forEach(video => {
        const folderName = video.parent_folder ? video.parent_folder.name : 'Uncategorized';
        if (!videosByFolder[folderName]) {
            videosByFolder[folderName] = [];
        }
        videosByFolder[folderName].push(video);
    });

    for (const folderName in videosByFolder) {
        const folderContainer = document.createElement('div');
        folderContainer.className = 'folder';
        folderContainer.innerHTML = `<h2>${folderName}</h2>`;

        videosByFolder[folderName].forEach(video => {
            const videoElement = document.createElement('div');
            videoElement.className = 'video';
            videoElement.innerHTML = `
                <h3>${video.name}</h3>
                <p><strong>Description:</strong> ${video.description || 'N/A'}</p>
                <p><strong>Tags:</strong> ${video.tags.map(tag => tag.name).join(', ') || 'N/A'}</p>
            `;
            folderContainer.appendChild(videoElement);
        });
        videoList.appendChild(folderContainer);
    }
};

// Initialize Netlify Identity and handle login/logout events
document.addEventListener('DOMContentLoaded', () => {
    const user = netlifyIdentity.currentUser();

    // If user is already logged in, show the app
    if (user) {
        appContainer.style.display = 'block';
        fetchVideos(user);
    }

    // When a user logs in
    netlifyIdentity.on('login', (loggedInUser) => {
        appContainer.style.display = 'block';
        fetchVideos(loggedInUser);
    });

    // When a user logs out
    netlifyIdentity.on('logout', () => {
        appContainer.style.display = 'none';
        videoList.innerHTML = ''; // Clear the video list
    });
});

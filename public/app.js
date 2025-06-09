const appContainer = document.getElementById('app-container');
const videoTbody = document.getElementById('video-list'); // Changed from video-list div to tbody

// --- NEW: SAVE FUNCTION ---
const handleSave = async (event, user) => {
    const saveButton = event.target;
    const row = saveButton.closest('tr');
    const videoId = row.dataset.videoId;

    // Indicate saving is in progress
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;

    // Get the new data from the editable cells
    const updates = {
        name: row.querySelector('.video-title').textContent,
        description: row.querySelector('.video-description').textContent,
        // Tags need to be a comma-separated string for the Vimeo API
        tags: row.querySelector('.video-tags').textContent,
    };

    try {
        const response = await fetch('/api/update-video', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${user.token.access_token}`,
            },
            body: JSON.stringify({ videoId, updates }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save changes.');
        }
        
        // Success
        saveButton.textContent = 'Saved!';
        setTimeout(() => { saveButton.textContent = 'Save'; }, 2000); // Reset after 2 seconds

    } catch (error) {
        console.error('Save Error:', error);
        alert(`Error saving video: ${error.message}`); // Show error to user
        saveButton.textContent = 'Retry'; // Allow user to try again
    } finally {
        saveButton.disabled = false;
    }
};

// --- UPDATED: RENDER FUNCTION ---
const renderVideos = (data, user) => {
    videoTbody.innerHTML = ''; // Clear the loading message or old data

    if (!data.data || data.data.length === 0) {
        videoTbody.innerHTML = '<tr><td colspan="5">No videos found in this account.</td></tr>';
        return;
    }

    data.data.forEach(video => {
        const row = document.createElement('tr');
        // Extract the numerical ID from the video URI (e.g., "/videos/12345" -> "12345")
        const videoId = video.uri.split('/').pop();
        row.dataset.videoId = videoId;

        // Make table cells editable with `contenteditable="true"`
        row.innerHTML = `
            <td class="video-title" contenteditable="true">${video.name || ''}</td>
            <td class="video-description" contenteditable="true">${video.description || ''}</td>
            <td class="video-tags" contenteditable="true">${video.tags.map(tag => tag.name).join(', ')}</td>
            <td>${video.status}</td>
            <td><button class="save-btn">Save</button></td>
        `;

        videoTbody.appendChild(row);

        // Add the event listener to the new save button
        row.querySelector('.save-btn').addEventListener('click', (event) => handleSave(event, user));
    });
};

// --- UPDATED: FETCH FUNCTION ---
const fetchVideos = async (user) => {
    videoTbody.innerHTML = '<tr><td colspan="5">Loading videos...</td></tr>';
    try {
        // Updated the fetch URL to get more fields, including status
        const response = await fetch('/api/vimeo?fields=uri,name,description,tags,status', {
            headers: {
                Authorization: `Bearer ${user.token.access_token}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch videos.');
        }

        const data = await response.json();
        renderVideos(data, user);

    } catch (error) {
        console.error('Fetch Error:', error);
        videoTbody.innerHTML = `<tr><td colspan="5" style="color: red;">Error: ${error.message}</td></tr>`;
    }
};

// --- UNCHANGED: IDENTITY AND EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    const user = netlifyIdentity.currentUser();

    if (user) {
        appContainer.style.display = 'block';
        fetchVideos(user);
    }

    netlifyIdentity.on('login', (loggedInUser) => {
        appContainer.style.display = 'block';
        fetchVideos(loggedInUser);
    });

    netlifyIdentity.on('logout', () => {
        appContainer.style.display = 'none';
        videoTbody.innerHTML = '';
    });
});

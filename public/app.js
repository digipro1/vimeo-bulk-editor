const appContainer = document.getElementById('app-container');
const videoTbody = document.getElementById('video-list');
const folderFilter = document.getElementById('folder-filter');

let allVideos = []; // Global variable to store all fetched videos
let currentUser = null; // Store the current user object

// --- RENDER TABLE FUNCTION ---
// Renders a given array of videos to the table
const renderTable = (videosToRender) => {
    videoTbody.innerHTML = ''; // Clear the table

    if (videosToRender.length === 0) {
        videoTbody.innerHTML = '<tr><td colspan="6">No videos match the current filter.</td></tr>';
        return;
    }

    videosToRender.forEach(video => {
        const row = document.createElement('tr');
        const videoId = video.uri.split('/').pop();
        const folderName = video.parent_folder ? video.parent_folder.name : '<em>No Folder</em>';
        row.dataset.videoId = videoId;

        row.innerHTML = `
            <td class="video-title" contenteditable="true">${video.name || ''}</td>
            <td class="video-description" contenteditable="true">${video.description || ''}</td>
            <td class="video-tags" contenteditable="true">${video.tags.map(tag => tag.name).join(', ')}</td>
            <td>${folderName}</td>
            <td>${video.status}</td>
            <td><button class="save-btn">Save</button></td>
        `;
        videoTbody.appendChild(row);
        row.querySelector('.save-btn').addEventListener('click', (event) => handleSave(event, currentUser));
    });
};

// --- POPULATE FOLDER FILTER ---
// Creates the options for the folder dropdown
const populateFilter = (videos) => {
    folderFilter.innerHTML = '<option value="all">All Folders</option>'; // Reset
    const folderNames = new Set(); // Use a Set to store only unique names
    
    videos.forEach(video => {
        if (video.parent_folder) {
            folderNames.add(video.parent_folder.name);
        }
    });

    // Sort folder names alphabetically and create options
    Array.from(folderNames).sort().forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        folderFilter.appendChild(option);
    });
};

// --- FILTER AND RENDER ---
// This function filters `allVideos` based on the dropdown and calls renderTable
const filterAndRender = () => {
    const selectedFolder = folderFilter.value;

    if (selectedFolder === 'all') {
        renderTable(allVideos); // Render all videos
    } else {
        const filteredVideos = allVideos.filter(video => 
            video.parent_folder && video.parent_folder.name === selectedFolder
        );
        renderTable(filteredVideos);
    }
};

// Attach event listener to the dropdown
folderFilter.addEventListener('change', filterAndRender);


// --- FETCH VIDEOS (from login) ---
// This is the main function called on login
const fetchAllVideos = async (user) => {
    videoTbody.innerHTML = '<tr><td colspan="6">Fetching all videos from your library... This may take a moment.</td></tr>';
    try {
        const response = await fetch('/api/vimeo?fields=uri,name,description,tags,status,parent_folder', {
            headers: { Authorization: `Bearer ${user.token.access_token}` },
        });

        if (!response.ok) throw new Error((await response.json()).error);

        const data = await response.json();
        allVideos = data.data; // Store all videos globally
        
        populateFilter(allVideos); // Create the filter options
        filterAndRender(); // Render the full table for the first time

    } catch (error) {
        console.error('Fetch Error:', error);
        videoTbody.innerHTML = `<tr><td colspan="6" style="color: red;">Error: ${error.message}</td></tr>`;
    }
};

// --- SAVE FUNCTION (Unchanged) ---
const handleSave = async (event, user) => {
    const saveButton = event.target;
    const row = saveButton.closest('tr');
    const videoId = row.dataset.videoId;

    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;

    const updates = {
        name: row.querySelector('.video-title').textContent,
        description: row.querySelector('.video-description').textContent,
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

        if (!response.ok) throw new Error((await response.json()).error);
        
        saveButton.textContent = 'Saved!';
        setTimeout(() => { saveButton.textContent = 'Save'; }, 2000);

    } catch (error) {
        console.error('Save Error:', error);
        alert(`Error saving video: ${error.message}`);
        saveButton.textContent = 'Retry';
    } finally {
        saveButton.disabled = false;
    }
};

// --- IDENTITY AND EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    netlifyIdentity.on('login', (user) => {
        currentUser = user;
        appContainer.style.display = 'block';
        fetchAllVideos(user);
    });

    netlifyIdentity.on('logout', () => {
        currentUser = null;
        allVideos = [];
        appContainer.style.display = 'none';
        videoTbody.innerHTML = '';
    });

    // Handle the case where the user is already logged in on page load
    if (netlifyIdentity.currentUser()) {
        currentUser = netlifyIdentity.currentUser();
        appContainer.style.display = 'block';
        fetchAllVideos(currentUser);
    }
});

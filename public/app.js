const appContainer = document.getElementById('app-container');
const videoTbody = document.getElementById('video-list');
const folderFilter = document.getElementById('folder-filter');

let allVideos = [];
let currentUser = null;

// --- FETCH VIDEOS (REWRITTEN FOR PAGINATION) ---
const fetchAllVideos = async (user) => {
    let nextPagePath = null;
    let pageCount = 0;
    allVideos = []; // Reset the video list

    const statusCell = document.querySelector('#video-list td');
    videoTbody.innerHTML = '<tr><td colspan="6">Fetching page 1 from your library...</td></tr>';

    try {
        do {
            pageCount++;
            const fetchUrl = nextPagePath ? `/api/vimeo?page=${encodeURIComponent(nextPagePath)}` : '/api/vimeo';
            
            const response = await fetch(fetchUrl, {
                headers: { Authorization: `Bearer ${user.token.access_token}` },
            });

            if (!response.ok) throw new Error((await response.json()).error);

            const pageData = await response.json();
            allVideos = allVideos.concat(pageData.data);
            nextPagePath = pageData.nextPagePath; // Get the next page path

            // Update the UI with progress
            videoTbody.innerHTML = `<tr><td colspan="6">Fetched ${allVideos.length} videos from ${pageCount} page(s)...</td></tr>`;

        } while (nextPagePath); // Continue while there is a next page

        // All pages are now fetched
        populateFilter(allVideos);
        filterAndRender();

    } catch (error) {
        console.error('Fetch Error:', error);
        videoTbody.innerHTML = `<tr><td colspan="6" style="color: red;">Error: ${error.message}</td></tr>`;
    }
};

// --- RENDER TABLE FUNCTION (Unchanged) ---
const renderTable = (videosToRender) => {
    videoTbody.innerHTML = '';
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

// --- POPULATE FOLDER FILTER (Unchanged) ---
const populateFilter = (videos) => {
    folderFilter.innerHTML = '<option value="all">All Folders</option>';
    const folderNames = new Set();
    videos.forEach(video => {
        if (video.parent_folder) folderNames.add(video.parent_folder.name);
    });
    Array.from(folderNames).sort().forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        folderFilter.appendChild(option);
    });
};

// --- FILTER AND RENDER (Unchanged) ---
const filterAndRender = () => {
    const selectedFolder = folderFilter.value;
    if (selectedFolder === 'all') {
        renderTable(allVideos);
    } else {
        const filteredVideos = allVideos.filter(video => 
            video.parent_folder && video.parent_folder.name === selectedFolder
        );
        renderTable(filteredVideos);
    }
};

folderFilter.addEventListener('change', filterAndRender);

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
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token.access_token}` },
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

// --- IDENTITY AND EVENT LISTENERS (Unchanged) ---
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

    if (netlifyIdentity.currentUser()) {
        currentUser = netlifyIdentity.currentUser();
        appContainer.style.display = 'block';
        fetchAllVideos(currentUser);
    }
});

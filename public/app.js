const appContainer = document.getElementById('app-container');
const folderFilter = document.getElementById('folder-filter');
const tableContainer = document.getElementById('table-container');
const videoTbody = document.getElementById('video-list');

let currentUser = null;

// --- 1. FETCH VIDEOS BY FOLDER ---
// This function is now triggered by the dropdown change event
const fetchVideosByFolder = async () => {
    const selectedFolderUri = folderFilter.value;
    if (!selectedFolderUri) {
        // This can happen if the folder list is empty.
        tableContainer.style.display = 'block';
        videoTbody.innerHTML = '<tr><td colspan="5">Please select a folder.</td></tr>';
        return;
    }

    // Show loading state
    tableContainer.style.display = 'block';
    videoTbody.innerHTML = `<tr><td colspan="5">Fetching videos from folder...</td></tr>`;
    folderFilter.disabled = true; // Disable dropdown during fetch
    
    try {
        const response = await fetch(`/api/vimeo?folderUri=${encodeURIComponent(selectedFolderUri)}`, {
            headers: { Authorization: `Bearer ${currentUser.token.access_token}` },
        });
        if (!response.ok) throw new Error((await response.json()).error);
        
        const { data } = await response.json();
        renderTable(data);

    } catch (error) {
        videoTbody.innerHTML = `<tr><td colspan="5" style="color: red;">Error: ${error.message}</td></tr>`;
    } finally {
        folderFilter.disabled = false; // Re-enable dropdown
    }
};

// --- 2. FETCH FOLDERS ON LOGIN ---
const fetchFolders = async (user) => {
    try {
        const response = await fetch('/api/get-folders', {
            headers: { Authorization: `Bearer ${user.token.access_token}` },
        });
        if (!response.ok) throw new Error('Could not fetch folders.');

        const { folders } = await response.json();
        
        folderFilter.innerHTML = '';
        if (folders.length === 0) {
            folderFilter.innerHTML = '<option value="">No folders found</option>';
            return;
        }

        folders.sort((a, b) => a.name.localeCompare(b.name));
        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.uri;
            option.textContent = folder.name;
            folderFilter.appendChild(option);
        });

        folderFilter.disabled = false;
        // **NEW**: Automatically fetch videos for the first folder in the list
        await fetchVideosByFolder();

    } catch (error) {
        folderFilter.innerHTML = `<option>Error loading folders</option>`;
        console.error(error);
    }
};

// **NEW**: Attach the event listener directly to the folder dropdown
folderFilter.addEventListener('change', fetchVideosByFolder);

// --- 3. RENDER THE TABLE (Unchanged) ---
const renderTable = (videos) => {
    videoTbody.innerHTML = '';
    if (videos.length === 0) {
        videoTbody.innerHTML = '<tr><td colspan="5">No videos found in this folder.</td></tr>';
        return;
    }
    videos.forEach(video => {
        const row = document.createElement('tr');
        row.dataset.videoId = video.uri.split('/').pop();
        row.innerHTML = `
            <td class="video-title" contenteditable="true">${video.name || ''}</td>
            <td class="video-description" contenteditable="true">${video.description || ''}</td>
            <td class="video-tags" contenteditable="true">${video.tags.map(tag => tag.name).join(', ')}</td>
            <td>${video.status}</td>
            <td><button class="save-btn">Save</button></td>
        `;
        videoTbody.appendChild(row);
        row.querySelector('.save-btn').addEventListener('click', (e) => handleSave(e, currentUser));
    });
};

// --- 4. SAVE FUNCTION (Unchanged) ---
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
        alert(`Error saving video: ${error.message}`);
        saveButton.textContent = 'Retry';
    } finally {
        saveButton.disabled = false;
    }
};

// --- 5. IDENTITY AND EVENT LISTENERS (Unchanged) ---
document.addEventListener('DOMContentLoaded', () => {
    netlifyIdentity.on('login', (user) => {
        currentUser = user;
        appContainer.style.display = 'block';
        fetchFolders(user);
    });

    netlifyIdentity.on('logout', () => {
        currentUser = null;
        appContainer.style.display = 'none';
        tableContainer.style.display = 'none';
        folderFilter.innerHTML = '<option>Loading folders...</option>';
    });

    if (netlifyIdentity.currentUser()) {
        currentUser = netlifyIdentity.currentUser();
        appContainer.style.display = 'block';
        fetchFolders(currentUser);
    }
});

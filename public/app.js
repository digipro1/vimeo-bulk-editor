const appContainer = document.getElementById('app-container');
const folderFilter = document.getElementById('folder-filter');
const tableContainer = document.getElementById('table-container');
const videoTbody = document.getElementById('video-list');
const saveAllBtn = document.getElementById('save-all-btn');
const manageFolderBtn = document.getElementById('manage-folder-btn'); // New Manage Folder button

let currentUser = null;
let originalVideoData = new Map();

// --- RENDER TABLE ---
const renderTable = (videos) => {
    videoTbody.innerHTML = '';
    originalVideoData.clear();
    saveAllBtn.style.display = 'none';
    manageFolderBtn.style.display = 'none';

    if (videos.length === 0) {
        videoTbody.innerHTML = '<tr><td colspan="7">No videos found in this folder.</td></tr>';
        return;
    }
    const privacyOptions = ['anybody', 'unlisted', 'password', 'nobody'];
    videos.forEach(video => {
        const videoId = video.uri.split('/').pop();
        originalVideoData.set(videoId, {
            name: video.name || '',
            description: video.description || '',
            tags: video.tags.map(tag => tag.name).join(', '),
            privacy: video.privacy.view,
        });
        const row = document.createElement('tr');
        row.dataset.videoId = videoId;
        const privacyDropdown = `<select class="privacy-select">${privacyOptions.map(opt => `<option value="${opt}" ${video.privacy.view === opt ? 'selected' : ''}>${opt.charAt(0).toUpperCase() + opt.slice(1)}</option>`).join('')}</select>`;
        row.innerHTML = `
            <td class="video-title" contenteditable="true">${video.name || ''}</td>
            <td class="video-description" contenteditable="true">${video.description || ''}</td>
            <td class="video-tags" contenteditable="true">${video.tags.map(tag => tag.name).join(', ')}</td>
            <td>${privacyDropdown}</td>
            <td>${video.status}</td>
            <td><a href="https://vimeo.com/manage/videos/${videoId}" target="_blank" class="manage-link">Manage</a></td>
            <td><button class="save-btn">Save</button></td>
        `;
        videoTbody.appendChild(row);
        row.querySelector('.save-btn').addEventListener('click', (e) => handleSave(e, currentUser));
    });

    saveAllBtn.style.display = 'inline-block';
    manageFolderBtn.style.display = 'inline-block';
};

// --- FETCH FOLDERS (UPDATED) ---
// Now stores the folder's web link in a data attribute
const fetchFolders = async (user) => {
    try {
        let allFolders = [];
        let nextPagePath = null;
        do {
            const fetchUrl = nextPagePath ? `/api/get-folders?page=${encodeURIComponent(nextPagePath)}` : '/api/get-folders';
            const response = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${user.token.access_token}` } });
            if (!response.ok) throw new Error((await response.json()).error);
            const pageData = await response.json();
            allFolders = allFolders.concat(pageData.folders);
            nextPagePath = pageData.nextPagePath;
        } while (nextPagePath);

        folderFilter.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = "Select a folder...";
        defaultOption.selected = true;
        defaultOption.disabled = true;
        folderFilter.appendChild(defaultOption);

        if (allFolders.length > 0) {
            allFolders.sort((a, b) => a.name.localeCompare(b.name));
            allFolders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder.uri;
                option.textContent = folder.name;
                // NEW: Store the web link in a data attribute
                option.dataset.link = folder.link; 
                folderFilter.appendChild(option);
            });
        }
        folderFilter.disabled = false;
    } catch (error) {
        folderFilter.innerHTML = `<option>Error loading folders</option>`;
        console.error(error);
    }
};

// --- FETCH VIDEOS BY FOLDER (UPDATED) ---
// Manages visibility of the new button
const fetchVideosByFolder = async () => {
    const selectedFolderUri = folderFilter.value;
    if (!selectedFolderUri) {
        tableContainer.style.display = 'none';
        videoTbody.innerHTML = '';
        saveAllBtn.style.display = 'none';
        manageFolderBtn.style.display = 'none';
        return;
    }
    tableContainer.style.display = 'block';
    videoTbody.innerHTML = `<tr><td colspan="7">Fetching videos from folder...</td></tr>`;
    folderFilter.disabled = true;
    saveAllBtn.style.display = 'none';
    manageFolderBtn.style.display = 'none';

    try {
        const response = await fetch(`/api/vimeo?folderUri=${encodeURIComponent(selectedFolderUri)}`, {
            headers: { Authorization: `Bearer ${currentUser.token.access_token}` },
        });
        if (!response.ok) throw new Error((await response.json()).error);
        const { data } = await response.json();
        renderTable(data);
    } catch (error) {
        videoTbody.innerHTML = `<tr><td colspan="7" style="color: red;">Error: ${error.message}</td></tr>`;
    } finally {
        folderFilter.disabled = false;
    }
};

// --- INDIVIDUAL SAVE FUNCTION ---
const handleSave = async (event, user) => {
    // ... same as before ...
    const saveButton = event.target;
    const row = saveButton.closest('tr');
    const videoId = row.dataset.videoId;
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;
    const selectedPrivacy = row.querySelector('.privacy-select').value;
    const updates = {
        name: row.querySelector('.video-title').textContent,
        description: row.querySelector('.video-description').textContent,
        tags: row.querySelector('.video-tags').textContent,
        privacy: { view: selectedPrivacy }
    };
    try {
        const response = await fetch('/api/update-video', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token.access_token}` },
            body: JSON.stringify({ videoId, updates }),
        });
        if (!response.ok) throw new Error((await response.json()).error);
        saveButton.textContent = 'Saved!';
        originalVideoData.set(videoId, { name: updates.name, description: updates.description, tags: updates.tags, privacy: updates.privacy.view });
        setTimeout(() => { saveButton.textContent = 'Save'; }, 2000);
    } catch (error) {
        alert(`Error saving video: ${error.message}`);
        saveButton.textContent = 'Retry';
    } finally {
        saveButton.disabled = false;
    }
};

// --- SAVE ALL CHANGES FUNCTION ---
const handleSaveAll = async () => {
    // ... same as before ...
    const changedRows = [];
    const allRows = videoTbody.querySelectorAll('tr');
    allRows.forEach(row => {
        const videoId = row.dataset.videoId;
        if (!videoId) return;
        const original = originalVideoData.get(videoId);
        const current = {
            name: row.querySelector('.video-title').textContent,
            description: row.querySelector('.video-description').textContent,
            tags: row.querySelector('.video-tags').textContent,
            privacy: row.querySelector('.privacy-select').value,
        };
        if (original.name !== current.name || original.description !== current.description || original.tags !== current.tags || original.privacy !== current.privacy) {
            changedRows.push({ videoId, updates: { name: current.name, description: current.description, tags: current.tags, privacy: { view: current.privacy } } });
        }
    });
    if (changedRows.length === 0) {
        alert('No changes to save.');
        return;
    }
    saveAllBtn.textContent = 'Saving...';
    saveAllBtn.disabled = true;
    folderFilter.disabled = true;
    manageFolderBtn.disabled = true;
    let successCount = 0;
    for (let i = 0; i < changedRows.length; i++) {
        const { videoId, updates } = changedRows[i];
        saveAllBtn.textContent = `Saving ${i + 1} of ${changedRows.length}...`;
        try {
            const response = await fetch('/api/update-video', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token.access_token}` },
                body: JSON.stringify({ videoId, updates }),
            });
            if (response.ok) successCount++;
        } catch (error) {
            console.error(`Failed to save video ${videoId}:`, error);
        }
    }
    alert(`Saved ${successCount} of ${changedRows.length} changed videos.`);
    saveAllBtn.textContent = 'Save All Changes';
    saveAllBtn.disabled = false;
    folderFilter.disabled = false;
    manageFolderBtn.disabled = false;
    await fetchVideosByFolder();
};

// --- NEW: MANAGE FOLDER BUTTON LOGIC ---
const handleManageFolder = () => {
    const selectedOption = folderFilter.options[folderFilter.selectedIndex];
    const folderLink = selectedOption.dataset.link;
    if (folderLink) {
        window.open(folderLink, '_blank');
    } else {
        alert('Could not find the link for the selected folder.');
    }
};

// --- PAGE AND AUTHENTICATION SETUP ---
document.addEventListener('DOMContentLoaded', () => {
    folderFilter.addEventListener('change', fetchVideosByFolder);
    saveAllBtn.addEventListener('click', handleSaveAll);
    manageFolderBtn.addEventListener('click', handleManageFolder); // Add listener for new button

    netlifyIdentity.on('login', (user) => {
        currentUser = user;
        appContainer.style.display = 'block';
        fetchFolders(user);
    });
    netlifyIdentity.on('logout', () => {
        currentUser = null;
        appContainer.style.display = 'none';
        tableContainer.style.display = 'none';
        saveAllBtn.style.display = 'none';
        manageFolderBtn.style.display = 'none';
    });
    const user = netlifyIdentity.currentUser();
    if (user) {
        currentUser = user;
        appContainer.style.display = 'block';
        fetchFolders(user);
    }
});

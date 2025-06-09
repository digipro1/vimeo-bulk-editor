const appContainer = document.getElementById('app-container');
const folderFilter = document.getElementById('folder-filter');
const tableContainer = document.getElementById('table-container');
const videoTbody = document.getElementById('video-list');

let currentUser = null;

const renderTable = (videos) => {
    videoTbody.innerHTML = '';
    if (videos.length === 0) {
        videoTbody.innerHTML = '<tr><td colspan="7">No videos found in this folder.</td></tr>';
        return;
    }
    const privacyOptions = ['anybody', 'unlisted', 'password', 'nobody'];
    videos.forEach(video => {
        const row = document.createElement('tr');
        const videoId = video.uri.split('/').pop();
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
};

const handleSave = async (event, user) => {
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
        setTimeout(() => { saveButton.textContent = 'Save'; }, 2000);
    } catch (error) {
        alert(`Error saving video: ${error.message}`);
        saveButton.textContent = 'Retry';
    } finally {
        saveButton.disabled = false;
    }
};

const fetchVideosByFolder = async () => {
    const selectedFolderUri = folderFilter.value;
    if (!selectedFolderUri) {
        tableContainer.style.display = 'block';
        videoTbody.innerHTML = '<tr><td colspan="7">Please select a folder.</td></tr>';
        return;
    }
    tableContainer.style.display = 'block';
    videoTbody.innerHTML = `<tr><td colspan="7">Fetching videos from folder...</td></tr>`;
    folderFilter.disabled = true;
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

const fetchFolders = async (user) => {
    let allFolders = [];
    let nextPagePath = null;
    try {
        do {
            const fetchUrl = nextPagePath ? `/api/get-folders?page=${encodeURIComponent(nextPagePath)}` : '/api/get-folders';
            const response = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${user.token.access_token}` } });
            if (!response.ok) throw new Error((await response.json()).error);
            const pageData = await response.json();
            allFolders = allFolders.concat(pageData.folders);
            nextPagePath = pageData.nextPagePath;
        } while (nextPagePath);
        folderFilter.innerHTML = '';
        if (allFolders.length === 0) {
            folderFilter.innerHTML = '<option value="">No folders found</option>';
            return;
        }
        allFolders.sort((a, b) => a.name.localeCompare(b.name));
        allFolders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.uri;
            option.textContent = folder.name;
            folderFilter.appendChild(option);
        });
        folderFilter.disabled = false;
        await fetchVideosByFolder();
    } catch (error) {
        folderFilter.innerHTML = `<option>Error loading folders</option>`;
        console.error(error);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    folderFilter.addEventListener('change', fetchVideosByFolder);

    netlifyIdentity.on('login', (user) => {
        currentUser = user;
        appContainer.style.display = 'block';
        fetchFolders(user);
    });

    netlifyIdentity.on('logout', () => {
        currentUser = null;
        appContainer.style.display = 'none';
        tableContainer.style.display = 'none';
    });
    
    const user = netlifyIdentity.currentUser();
    if (user) {
        currentUser = user;
        appContainer.style.display = 'block';
        fetchFolders(user);
    }
});

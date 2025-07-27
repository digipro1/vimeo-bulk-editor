const appContainer = document.getElementById('app-container');
const folderFilter = document.getElementById('folder-filter');
const tableContainer = document.getElementById('table-container');
const videoTbody = document.getElementById('video-list');
const saveAllBtn = document.getElementById('save-all-btn');
const manageFolderBtn = document.getElementById('manage-folder-btn');
const bulkEditBar = document.getElementById('bulk-edit-bar');
const selectionCounter = document.getElementById('selection-counter');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const applyBulkEditBtn = document.getElementById('apply-bulk-edit-btn');
const downloadCaptionsBtn = document.getElementById('download-captions-btn');
const tableHeader = document.querySelector('#video-table thead');

let currentUser = null;
let originalVideoData = new Map();
let selectedVideoIds = new Set(); 
let currentVideos = [];
let sortState = { column: null, direction: 'asc' };
let currentlyEditingVideoId = null;

// --- RICH TEXT EDITOR MODAL LOGIC ---
const openDescriptionEditor = (videoId) => {
    currentlyEditingVideoId = videoId;
    const row = videoTbody.querySelector(`tr[data-video-id="${videoId}"]`);
    if (!row) return;

    const currentDescriptionHtml = originalVideoData.get(videoId)?.description || '';
    
    descriptionModal.style.display = 'flex';
    
    tinymce.init({
        selector: '#tinymce-textarea',
        height: 350,
        menubar: false,
        plugins: 'lists link',
        toolbar: 'undo redo | blocks | bold italic underline | bullist numlist | link',
        setup: (editor) => {
            editor.on('init', () => editor.setContent(currentDescriptionHtml));
        }
    });
};

const closeDescriptionEditor = () => {
    if (tinymce.get('tinymce-textarea')) {
        tinymce.get('tinymce-textarea').remove();
    }
    descriptionModal.style.display = 'none';
    currentlyEditingVideoId = null;
};

const saveDescriptionFromModal = () => {
    if (!currentlyEditingVideoId) return;

    const editorContent = tinymce.get('tinymce-textarea').getContent();
    const row = videoTbody.querySelector(`tr[data-video-id="${currentlyEditingVideoId}"]`);
    if (row) {
        const descriptionCell = row.querySelector('.description-cell');
        descriptionCell.innerHTML = editorContent;
    }
    closeDescriptionEditor();
};


// --- RENDER TABLE ---
const renderTable = (videos) => {
    videoTbody.innerHTML = '';
    const isNewData = videos !== currentVideos;
    if (isNewData) {
      originalVideoData.clear();
      currentVideos = videos;
    }
    if (videos.length === 0) {
        videoTbody.innerHTML = '<tr><td colspan="9">No videos found in this folder.</td></tr>';
        saveAllBtn.style.display = 'none';
        manageFolderBtn.style.display = 'none';
        return;
    }
    const privacyOptions = ['anybody', 'unlisted', 'password', 'nobody'];
    videos.forEach(video => {
        const videoId = video.uri.split('/').pop();
        if (isNewData) {
            originalVideoData.set(videoId, {
                name: video.name || '', description: video.description || '',
                tags: video.tags.map(tag => tag.name).join(', '), privacy: video.privacy.view,
            });
        }
        const row = document.createElement('tr');
        row.dataset.videoId = videoId;
        const privacyDropdown = `<select class="privacy-select">${privacyOptions.map(opt => `<option value="${opt}" ${video.privacy.view === opt ? 'selected' : ''}>${opt.charAt(0).toUpperCase() + opt.slice(1)}</option>`).join('')}</select>`;
        row.innerHTML = `
            <td><input type="checkbox" class="video-checkbox" data-video-id="${videoId}"></td>
            <td class="video-title" contenteditable="true">${video.name || ''}</td>
            <td class="description-cell">${video.description || '(No description)'}</td>
            <td class="video-tags" contenteditable="true">${video.tags.map(tag => tag.name).join(', ')}</td>
            <td>${privacyDropdown}</td>
            <td>${video.status}</td>
            <td>${formatDuration(video.duration)}</td>
            <td><a href="https://vimeo.com/manage/videos/${videoId}" target="_blank" class="manage-link">Manage</a></td>
            <td><button class="save-btn">Save</button></td>
        `;
        videoTbody.appendChild(row);
        row.querySelector('.save-btn').addEventListener('click', (e) => handleSave(e, currentUser));
        row.querySelector('.video-checkbox').addEventListener('change', handleSelectionChange);
    });
    saveAllBtn.style.display = 'inline-block';
    manageFolderBtn.style.display = 'inline-block';
    selectedVideoIds.clear();
    updateBulkEditUI();
    updateSortIcons();
};

// --- GET UPDATES FROM A ROW (HELPER) ---
const getUpdatesFromRow = (row) => {
    const videoId = row.dataset.videoId;
    return {
        videoId: videoId,
        updates: {
            name: row.querySelector('.video-title').textContent,
            description: row.querySelector('.description-cell').innerHTML,
            tags: parseTagsForAPI(row.querySelector('.video-tags').textContent),
            privacy: { view: row.querySelector('.privacy-select').value }
        }
    };
};

// --- ALL OTHER FUNCTIONS ---
const handleSave = async (event, user) => {
    const saveButton = event.target;
    const row = saveButton.closest('tr');
    const { videoId, updates } = getUpdatesFromRow(row);
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;
    try {
        const response = await fetch('/api/update-video', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token.access_token}` },
            body: JSON.stringify({ videoId, updates }),
        });
        if (!response.ok) throw new Error((await response.json()).error);
        saveButton.textContent = 'Saved!';
        originalVideoData.set(videoId, { ...updates, tags: updates.tags.map(t=>t.name).join(', '), privacy: updates.privacy.view });
        setTimeout(() => { saveButton.textContent = 'Save'; }, 2000);
    } catch (error) {
        alert(`Error saving video: ${error.message}`);
        saveButton.textContent = 'Retry';
    } finally {
        saveButton.disabled = false;
    }
};

// **THIS IS THE MISSING FUNCTION THAT IS BEING RESTORED**
const handleDownloadCaptions = async () => {
    if (selectedVideoIds.size === 0) {
        alert('Please select videos to download captions from.');
        return;
    }
    downloadCaptionsBtn.textContent = 'Preparing...';
    downloadCaptionsBtn.disabled = true;
    let downloadedCount = 0;
    let videoIndex = 0;
    for (const videoId of selectedVideoIds) {
        videoIndex++;
        downloadCaptionsBtn.textContent = `Downloading ${videoIndex}/${selectedVideoIds.size}...`;
        try {
            const tracksResponse = await fetch(`/api/get-captions?videoId=${videoId}`, {
                headers: { Authorization: `Bearer ${currentUser.token.access_token}` }
            });
            if (!tracksResponse.ok) {
                console.error(`Could not fetch caption info for video ${videoId}`);
                continue;
            }
            const tracks = await tracksResponse.json();
            if (tracks.length > 0) {
                const firstTrack = tracks[0];
                const fileResponse = await fetch(firstTrack.link);
                const vttText = await fileResponse.text();
                const blob = new Blob([vttText], { type: 'text/vtt' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                const videoData = originalVideoData.get(videoId);
                const videoTitle = videoData ? videoData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : videoId;
                a.download = `${videoTitle}.${firstTrack.language}.vtt`;
                a.href = url;
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(url);
                a.remove();
                downloadedCount++;
            }
        } catch (error) {
            console.error(`Failed to download caption for video ${videoId}:`, error);
        }
    }
    alert(`Downloaded ${downloadedCount} of ${selectedVideoIds.size} available caption files.`);
    downloadCaptionsBtn.textContent = 'Download Captions';
    downloadCaptionsBtn.disabled = false;
};

// --- PASTE IN THE REST OF THE FUNCTIONS (UNCHANGED) ---
const formatDuration = (seconds) => { /* ... */ };
const updateSortIcons = () => { /* ... */ };
const sortVideos = (key) => { /* ... */ };
const fetchVideosByFolder = async () => { /* ... */ };
const parseTagsForAPI = (tagString) => { /* ... */ };
const fetchFolders = async (user) => { /* ... */ };
const updateBulkEditUI = () => { /* ... */ };
const handleSelectionChange = (event) => { /* ... */ };
const handleSaveAll = async () => { /* ... */ };
const handleBulkUpdate = async () => { /* ... */ };
const handleManageFolder = () => { /* ... */ };

// --- PAGE AND AUTHENTICATION SETUP ---
document.addEventListener('DOMContentLoaded', () => { /* ... */ });

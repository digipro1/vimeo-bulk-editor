const appContainer = document.getElementById('app-container');
const folderFilter = document.getElementById('folder-filter');
const tableContainer = document.getElementById('table-container');
const videoTbody = document.getElementById('video-list');
const saveAllBtn = document.getElementById('save-all-btn');
const bulkEditBar = document.getElementById('bulk-edit-bar');
const selectionCounter = document.getElementById('selection-counter');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const applyBulkEditBtn = document.getElementById('apply-bulk-edit-btn');
const downloadCaptionsBtn = document.getElementById('download-captions-btn');
const descriptionModal = document.getElementById('description-modal');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');

let currentUser = null;
let originalVideoData = new Map();
let selectedVideoIds = new Set(); 
let currentlyEditingVideoId = null;

// The core "Keys" from your Data Governance strategy
const GOVERNANCE_KEYS = ['Minister', 'Scripture', 'Event Type', 'Topic', 'Location', 'Audience', 'Title', 'Date'];

// --- METADATA PARSING & ASSEMBLY ---
const parseVimeoDescription = (fullText) => {
    if (!fullText) return { summary: '', metadata: {} };
    const parts = fullText.split('---');
    const summary = parts[0].trim();
    const metadata = {};
    
    if (parts[1]) {
        const lines = parts[1].split('\n');
        lines.forEach(line => {
            const [key, ...val] = line.split(':');
            if (key && val.length > 0) {
                const trimmedKey = key.trim();
                metadata[trimmedKey] = val.join(':').trim();
            }
        });
    }
    return { summary, metadata };
};

const assembleVimeoDescription = (summary, metadata) => {
    let newDesc = summary + '\n---\n';
    GOVERNANCE_KEYS.forEach(key => {
        if (metadata[key]) {
            newDesc += `${key}: ${metadata[key]}\n`;
        }
    });
    return newDesc.trim();
};

// --- TABLE RENDERING ---
const renderTable = (videos) => {
    videoTbody.innerHTML = '';
    originalVideoData.clear();

    videos.forEach(video => {
        const videoId = video.uri.split('/').pop();
        const { summary, metadata } = parseVimeoDescription(video.description || '');
        
        // Store the parsed state
        originalVideoData.set(videoId, { summary, metadata, name: video.name });

        const row = document.createElement('tr');
        row.dataset.videoId = videoId;
        row.innerHTML = `
            <td><input type="checkbox" class="video-checkbox" data-video-id="${videoId}"></td>
            <td class="summary-cell" style="cursor:pointer; max-width:200px; overflow:hidden;">${summary || '(Edit Summary)'}</td>
            <td contenteditable="true" class="meta-Minister">${metadata['Minister'] || ''}</td>
            <td contenteditable="true" class="meta-Scripture">${metadata['Scripture'] || ''}</td>
            <td contenteditable="true" class="meta-EventType">${metadata['Event Type'] || ''}</td>
            <td contenteditable="true" class="meta-Topic">${metadata['Topic'] || ''}</td>
            <td contenteditable="true" class="meta-Location">${metadata['Location'] || ''}</td>
            <td contenteditable="true" class="meta-Audience">${metadata['Audience'] || ''}</td>
            <td><button class="save-btn">Save</button></td>
        `;
        videoTbody.appendChild(row);
    });
    tableContainer.style.display = 'block';
    saveAllBtn.style.display = 'inline-block';
};

// --- INDIVIDUAL SAVE ---
const handleSave = async (row) => {
    const videoId = row.dataset.videoId;
    const saveBtn = row.querySelector('.save-btn');
    saveBtn.innerText = 'Saving...';

    const summary = row.querySelector('.summary-cell').innerHTML;
    const metadata = {};
    GOVERNANCE_KEYS.forEach(key => {
        const cleanKey = key.replace(/\s+/g, '');
        const cell = row.querySelector(`.meta-${cleanKey}`);
        if (cell) metadata[key] = cell.innerText.trim();
    });

    const finalDescription = assembleVimeoDescription(summary, metadata);
    
    try {
        const response = await fetch('/api/update-video', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token.access_token}` },
            body: JSON.stringify({ videoId, updates: { description: finalDescription } }),
        });
        if (response.ok) {
            saveBtn.innerText = 'Saved!';
            setTimeout(() => saveBtn.innerText = 'Save', 2000);
        }
    } catch (err) {
        console.error(err);
        saveBtn.innerText = 'Error';
    }
};

// --- BULK UPDATE LOGIC ---
const handleBulkUpdate = () => {
    const bulkVals = {
        'Event Type': document.getElementById('bulk-event-type').value,
        'Minister': document.getElementById('bulk-minister').value.trim(),
        'Location': document.getElementById('bulk-location').value.trim(),
        'Audience': document.getElementById('bulk-audience').value
    };

    selectedVideoIds.forEach(id => {
        const row = document.querySelector(`tr[data-video-id="${id}"]`);
        if (!row) return;
        Object.keys(bulkVals).forEach(key => {
            if (bulkVals[key]) {
                const cleanKey = key.replace(/\s+/g, '');
                const cell = row.querySelector(`.meta-${cleanKey}`);
                if (cell) cell.innerText = bulkVals[key];
            }
        });
    });
    alert('Local changes applied to selected. Click Save to upload to Vimeo.');
};

// --- CAPTION DOWNLOAD ---
const handleDownloadCaptions = async () => {
    if (selectedVideoIds.size === 0) return alert('Select videos first');
    downloadCaptionsBtn.disabled = true;
    for (const id of selectedVideoIds) {
        try {
            const res = await fetch(`/api/get-captions?videoId=${id}`, {
                headers: { Authorization: `Bearer ${currentUser.token.access_token}` }
            });
            const tracks = await res.json();
            if (tracks.length > 0) {
                const fileRes = await fetch(tracks[0].link);
                const text = await fileRes.text();
                const blob = new Blob([text], { type: 'text/vtt' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `captions_${id}.vtt`;
                a.click();
            }
        } catch (e) { console.error(e); }
    }
    downloadCaptionsBtn.disabled = false;
};

// --- APP FLOW ---
const fetchVideosByFolder = async () => {
    const uri = folderFilter.value;
    const res = await fetch(`/api/vimeo?folderUri=${encodeURIComponent(uri)}`, {
        headers: { Authorization: `Bearer ${currentUser.token.access_token}` }
    });
    const { data } = await res.json();
    renderTable(data);
};

document.addEventListener('DOMContentLoaded', () => {
    folderFilter.addEventListener('change', fetchVideosByFolder);
    applyBulkEditBtn.addEventListener('click', handleBulkUpdate);
    downloadCaptionsBtn.addEventListener('click', handleDownloadCaptions);

    // Modal Events
    modalSaveBtn.addEventListener('click', () => {
        const row = document.querySelector(`tr[data-video-id="${currentlyEditingVideoId}"]`);
        row.querySelector('.summary-cell').innerHTML = tinymce.get('tinymce-textarea').getContent();
        descriptionModal.style.display = 'none';
        tinymce.get('tinymce-textarea').remove();
    });

    videoTbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('summary-cell')) {
            currentlyEditingVideoId = e.target.closest('tr').dataset.videoId;
            descriptionModal.style.display = 'flex';
            tinymce.init({
                selector: '#tinymce-textarea',
                height: 300,
                menubar: false,
                setup: (ed) => ed.on('init', () => ed.setContent(e.target.innerHTML))
            });
        }
        if (e.target.classList.contains('save-btn')) {
            handleSave(e.target.closest('tr'));
        }
    });

    videoTbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('video-checkbox')) {
            const id = e.target.dataset.videoId;
            e.target.checked ? selectedVideoIds.add(id) : selectedVideoIds.delete(id);
            bulkEditBar.style.display = selectedVideoIds.size > 0 ? 'block' : 'none';
            selectionCounter.innerText = `${selectedVideoIds.size} video(s) selected`;
        }
    });

    netlifyIdentity.on('login', user => {
        currentUser = user;
        appContainer.style.display = 'block';
        // Add folder fetching logic here
    });
});

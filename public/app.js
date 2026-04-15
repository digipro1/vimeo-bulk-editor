const appContainer = document.getElementById('app-container');
const folderFilter = document.getElementById('folder-filter');
const searchInput = document.getElementById('search-input');
const toggleColumnsBtn = document.getElementById('toggle-columns-btn');
const columnTogglePanel = document.getElementById('column-toggle-panel');
const tableContainer = document.getElementById('table-container');
const videoTable = document.getElementById('video-table');
const videoTbody = document.getElementById('video-list');
const saveAllBtn = document.getElementById('save-all-btn');
const bulkEditBar = document.getElementById('bulk-edit-bar');
const selectionCounter = document.getElementById('selection-counter');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const applyBulkEditBtn = document.getElementById('apply-bulk-edit-btn');
const downloadCaptionsBtn = document.getElementById('download-captions-btn');
const descriptionModal = document.getElementById('description-modal');

let currentUser = null;
let originalVideoData = new Map();
let selectedVideoIds = new Set(); 
let currentlyEditingVideoId = null;

let allFoldersMap = new Map(); 

const GOVERNANCE_KEYS = [
    'Title', 'Series', 'Date', 'Minister', 'Scripture', 
    'Supporting Scripture', 'Event Type', 'Topic', 
    'Features', 'Holiday', 'Location', 'Audience'
];

const MULTI_VALUE_KEYS = ['Features', 'Holiday', 'Topic', 'Supporting Scripture'];
const activeFilters = {}; 
let currentFilterPanelKey = null;

// --- DATA EXTRACTION ---
const getBookName = (scriptureStr) => {
    if (!scriptureStr) return '';
    const match = scriptureStr.match(/^(\d\s+)?[a-zA-Z\s]+/);
    return match ? match[0].trim() : scriptureStr.trim();
};

const extractValues = (key, rawValue) => {
    if (!rawValue) return [];
    if (MULTI_VALUE_KEYS.includes(key)) {
        return rawValue.split(',').map(s => {
            let v = s.trim();
            if (key === 'Supporting Scripture') v = getBookName(v);
            return v;
        }).filter(Boolean);
    } else {
        let v = rawValue.trim();
        if (key === 'Scripture') v = getBookName(v);
        return [v].filter(Boolean);
    }
};

const parseVimeoDescription = (fullText) => {
    if (!fullText) return { summary: '', metadata: {} };
    const parts = fullText.split('---');
    const summary = parts[0].trim();
    const metadata = {};
    if (parts[1]) {
        parts[1].split('\n').forEach(line => {
            const [key, ...val] = line.split(':');
            if (key && val.length > 0) metadata[key.trim()] = val.join(':').trim();
        });
    }
    return { summary, metadata };
};

const assembleVimeoDescription = (summary, metadata) => {
    let newDesc = summary + '\n---\n';
    GOVERNANCE_KEYS.forEach(key => {
        if (metadata[key]) newDesc += `${key}: ${metadata[key]}\n`;
    });
    return newDesc.trim();
};

// --- FILTERS ---
const applyTableFilters = () => {
    const term = searchInput.value.toLowerCase();
    const rows = videoTbody.querySelectorAll('tr');

    rows.forEach(row => {
        const videoId = row.dataset.videoId;
        const meta = originalVideoData.get(videoId).metadata;

        let passes = row.innerText.toLowerCase().includes(term);

        if (passes) {
            for (const key of GOVERNANCE_KEYS) {
                const sel = activeFilters[key];
                if (!sel || sel.length === 0) continue;

                const videoValues = extractValues(key, meta[key]);
                if (!videoValues.some(item => sel.includes(item))) {
                    passes = false; 
                    break; 
                }
            }
        }
        row.style.display = passes ? '' : 'none';
    });
    updateSelectAllUI();
};

const openFilterPanel = (key, btnElement) => {
    currentFilterPanelKey = key;
    const panel = document.getElementById('table-filter-panel');
    const optionsContainer = document.getElementById('filter-panel-options');
    
    document.getElementById('filter-panel-title').innerText = `Filter ${key}`;
    optionsContainer.innerHTML = '';

    const uniqueValues = new Set();
    originalVideoData.forEach(video => {
        const values = extractValues(key, video.metadata[key]);
        values.forEach(v => uniqueValues.add(v));
    });

    const sortedValues = Array.from(uniqueValues).sort();
    const selectedValues = activeFilters[key] || [];

    if (sortedValues.length === 0) {
        optionsContainer.innerHTML = '<i>No data found</i>';
    } else {
        sortedValues.forEach(val => {
            const lbl = document.createElement('label');
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = val;
            chk.checked = selectedValues.includes(val);
            lbl.appendChild(chk);
            lbl.appendChild(document.createTextNode(val));
            optionsContainer.appendChild(lbl);
        });
    }

    const rect = btnElement.getBoundingClientRect();
    panel.style.left = `${rect.left + window.scrollX}px`;
    panel.style.top = `${rect.bottom + window.scrollY + 5}px`;
    panel.style.display = 'flex';
};

document.getElementById('filter-panel-apply').addEventListener('click', () => {
    const checked = document.querySelectorAll('#filter-panel-options input:checked');
    const selected = Array.from(checked).map(c => c.value);
    const btn = document.querySelector(`.filter-btn[data-key="${currentFilterPanelKey}"]`);

    if (selected.length > 0) {
        activeFilters[currentFilterPanelKey] = selected;
        btn.classList.add('active');
    } else {
        delete activeFilters[currentFilterPanelKey];
        btn.classList.remove('active');
    }
    document.getElementById('table-filter-panel').style.display = 'none';
    applyTableFilters();
});

document.getElementById('filter-panel-clear').addEventListener('click', () => {
    delete activeFilters[currentFilterPanelKey];
    document.querySelector(`.filter-btn[data-key="${currentFilterPanelKey}"]`).classList.remove('active');
    document.getElementById('table-filter-panel').style.display = 'none';
    applyTableFilters();
});

const initColumnToggles = () => {
    const cols = ['Summary', ...GOVERNANCE_KEYS];
    columnTogglePanel.innerHTML = '';
    cols.forEach(col => {
        const lbl = document.createElement('label');
        lbl.innerHTML = `<input type="checkbox" checked data-col="${col.replace(/\s+/g, '')}"> ${col}`;
        columnTogglePanel.appendChild(lbl);
    });

    columnTogglePanel.addEventListener('change', (e) => {
        if(e.target.tagName === 'INPUT') {
            const cls = `hide-col-${e.target.dataset.col}`;
            e.target.checked ? videoTable.classList.remove(cls) : videoTable.classList.add(cls);
        }
    });

    toggleColumnsBtn.addEventListener('click', () => {
        columnTogglePanel.style.display = columnTogglePanel.style.display === 'none' ? 'flex' : 'none';
    });
};

// --- DATA FETCHING ---
const fetchFolders = async (user) => {
    try {
        let allFolders = []; 
        let nextPagePath = null;
        do {
            const res = await fetch(nextPagePath ? `/api/get-folders?page=${encodeURIComponent(nextPagePath)}` : '/api/get-folders', 
                { headers: { Authorization: `Bearer ${user.token.access_token}` } });
            const data = await res.json();
            allFolders = allFolders.concat(data.folders);
            nextPagePath = data.nextPagePath;
        } while (nextPagePath);

        allFoldersMap.clear();
        allFolders.forEach(f => allFoldersMap.set(f.uri, { ...f, children: [] }));

        const rootFolders = [];
        allFoldersMap.forEach(f => {
            const parentUri = f.metadata?.connections?.parent_folder?.uri || f.parent_folder?.uri;
            if (parentUri && allFoldersMap.has(parentUri)) {
                allFoldersMap.get(parentUri).children.push(f);
            } else {
                rootFolders.push(f);
            }
        });

        const sortFolders = (folders) => {
            folders.sort((a, b) => a.name.localeCompare(b.name));
            folders.forEach(f => sortFolders(f.children));
        };
        sortFolders(rootFolders);

        folderFilter.innerHTML = '<option value="" disabled selected>Select a folder...</option>';
        const buildSelectUI = (folders, depth = 0) => {
            const indent = '\u00A0\u00A0\u00A0\u00A0'.repeat(depth);
            const prefix = depth > 0 ? '└─ ' : '';
            folders.forEach(f => {
                const option = document.createElement('option');
                option.value = f.uri;
                option.textContent = indent + prefix + f.name;
                folderFilter.appendChild(option);
                buildSelectUI(f.children, depth + 1);
            });
        };
        buildSelectUI(rootFolders);

    } catch (e) { console.error('Error fetching folders:', e); }
};

const fetchVideosByFolder = async () => {
    const selectedUri = folderFilter.value;
    if (!selectedUri) return;
    
    tableContainer.style.display = 'block';
    searchInput.disabled = true;
    toggleColumnsBtn.disabled = true;

    const urisToFetch = [selectedUri];
    const getDescendants = (uri) => {
        const folder = allFoldersMap.get(uri);
        if (folder && folder.children) {
            folder.children.forEach(c => {
                urisToFetch.push(c.uri);
                getDescendants(c.uri); 
            });
        }
    };
    getDescendants(selectedUri);

    videoTbody.innerHTML = `<tr><td colspan="17">Loading videos from ${urisToFetch.length} folder(s)...</td></tr>`;
    
    try {
        const fetchPromises = urisToFetch.map(uri => 
            fetch(`/api/vimeo?folderUri=${encodeURIComponent(uri)}`, {
                headers: { Authorization: `Bearer ${currentUser.token.access_token}` }
            }).then(res => {
                if (!res.ok) throw new Error('API Error');
                return res.json();
            })
        );

        const results = await Promise.all(fetchPromises);
        
        let allVideos = [];
        results.forEach(res => {
            if (res.data && res.data.length > 0) {
                allVideos = allVideos.concat(res.data);
            }
        });

        const uniqueVideosMap = new Map();
        allVideos.forEach(v => uniqueVideosMap.set(v.uri, v));
        const uniqueVideos = Array.from(uniqueVideosMap.values());
        
        if (uniqueVideos.length > 0) {
            renderTable(uniqueVideos);
        } else {
            videoTbody.innerHTML = '<tr><td colspan="17">No videos found in this folder or its subfolders.</td></tr>';
            saveAllBtn.style.display = 'none';
        }
    } catch (error) {
        console.error(error);
        videoTbody.innerHTML = '<tr><td colspan="17" style="color:red;">Error loading videos. Check the developer console.</td></tr>';
    }
    
    searchInput.disabled = false;
    toggleColumnsBtn.disabled = false;
};

// --- TABLE RENDERING ---
const renderTable = (videos) => {
    videoTbody.innerHTML = ''; originalVideoData.clear();
    for (let key in activeFilters) delete activeFilters[key];
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));

    videos.forEach(video => {
        const videoId = video.uri.split('/').pop();
        const { summary, metadata } = parseVimeoDescription(video.description || '');
        originalVideoData.set(videoId, { summary, metadata, name: video.name });

        const row = document.createElement('tr');
        row.dataset.videoId = videoId;
        row.innerHTML = `
            <td class="col-Checkbox"><input type="checkbox" class="video-checkbox" data-video-id="${videoId}"></td>
            <td class="col-NativeTitle" title="${video.name}">${video.name || '(No Title)'}</td>
            <td class="col-Summary summary-cell" style="cursor:pointer; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${summary || '(Edit Summary)'}</td>
            ${GOVERNANCE_KEYS.map(k => `<td contenteditable="true" class="col-${k.replace(/\s+/g, '')} meta-${k.replace(/\s+/g, '')}">${metadata[k] || ''}</td>`).join('')}
            <td class="col-Manage"><a href="https://vimeo.com/manage/videos/${videoId}" target="_blank" class="manage-link">Manage</a></td>
            <td class="col-Action"><button class="save-btn">Save</button></td>
        `;
        videoTbody.appendChild(row);
    });
    saveAllBtn.style.display = 'inline-block';
    applyTableFilters(); 
};

// --- BULK & SAVE LOGIC ---
const updateSelectAllUI = () => {
    const visible = Array.from(document.querySelectorAll('.video-checkbox')).filter(c => c.closest('tr').style.display !== 'none');
    selectAllCheckbox.checked = visible.length > 0 && visible.every(c => c.checked);
};

const handleSave = async (row) => {
    const videoId = row.dataset.videoId;
    const saveBtn = row.querySelector('.save-btn');
    saveBtn.innerText = 'Saving...';
    
    const summary = row.querySelector('.summary-cell').innerHTML;
    const metadata = {};
    GOVERNANCE_KEYS.forEach(k => {
        const cell = row.querySelector(`.meta-${k.replace(/\s+/g, '')}`);
        if (cell) metadata[k] = cell.innerText.trim();
    });

    try {
        const res = await fetch('/api/update-video', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token.access_token}` },
            body: JSON.stringify({ videoId, updates: { description: assembleVimeoDescription(summary, metadata) } }),
        });
        if (res.ok) { saveBtn.innerText = 'Saved!'; setTimeout(() => saveBtn.innerText = 'Save', 2000); }
    } catch (err) { saveBtn.innerText = 'Error'; }
};

const handleSaveAll = async () => {
    const visibleRows = Array.from(videoTbody.querySelectorAll('tr')).filter(r => r.style.display !== 'none');
    saveAllBtn.innerText = 'Saving All...'; saveAllBtn.disabled = true;
    for (const row of visibleRows) await handleSave(row);
    saveAllBtn.innerText = 'Save All Changes'; saveAllBtn.disabled = false;
};

const handleBulkUpdate = () => {
    const bulkVals = {
        'Event Type': document.getElementById('bulk-event-type').value,
        'Series': document.getElementById('bulk-series').value.trim(),
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
    
    document.getElementById('bulk-event-type').value = '';
    document.getElementById('bulk-series').value = '';
    document.getElementById('bulk-minister').value = '';
    document.getElementById('bulk-location').value = '';
    document.getElementById('bulk-audience').value = '';
    
    alert('Local metadata updated for selected videos. Don\'t forget to click Save All Changes!');
};

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

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    searchInput.addEventListener('input', applyTableFilters);
    folderFilter.addEventListener('change', fetchVideosByFolder);
    document.getElementById('apply-bulk-edit-btn').addEventListener('click', handleBulkUpdate);
    document.getElementById('save-all-btn').addEventListener('click', handleSaveAll);
    downloadCaptionsBtn.addEventListener('click', handleDownloadCaptions);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openFilterPanel(e.target.dataset.key, e.target));
    });

    document.addEventListener('mousedown', (e) => {
        const fp = document.getElementById('table-filter-panel');
        const cp = document.getElementById('column-toggle-panel');
        if (fp && fp.style.display !== 'none' && !fp.contains(e.target) && !e.target.classList.contains('filter-btn')) fp.style.display = 'none';
        if (cp && cp.style.display !== 'none' && !cp.contains(e.target) && e.target.id !== 'toggle-columns-btn') cp.style.display = 'none';
    });

    videoTbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('summary-cell')) {
            currentlyEditingVideoId = e.target.closest('tr').dataset.videoId;
            document.getElementById('description-modal').style.display = 'flex';
            tinymce.init({ selector: '#tinymce-textarea', height: 300, menubar: false, setup: ed => ed.on('init', () => ed.setContent(e.target.innerHTML)) });
        }
        if (e.target.classList.contains('save-btn')) handleSave(e.target.closest('tr'));
    });

    document.getElementById('modal-save-btn').addEventListener('click', () => {
        document.querySelector(`tr[data-video-id="${currentlyEditingVideoId}"] .summary-cell`).innerHTML = tinymce.get('tinymce-textarea').getContent();
        document.getElementById('description-modal').style.display = 'none'; tinymce.get('tinymce-textarea').remove();
    });

    document.getElementById('modal-cancel-btn').addEventListener('click', () => {
        document.getElementById('description-modal').style.display = 'none'; if (tinymce.get('tinymce-textarea')) tinymce.get('tinymce-textarea').remove();
    });

    videoTbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('video-checkbox')) {
            e.target.checked ? selectedVideoIds.add(e.target.dataset.videoId) : selectedVideoIds.delete(e.target.dataset.videoId);
            updateSelectAllUI();
            document.getElementById('bulk-edit-bar').style.display = selectedVideoIds.size > 0 ? 'block' : 'none';
            document.getElementById('selection-counter').innerText = `${selectedVideoIds.size} video(s) selected`;
        }
    });

    selectAllCheckbox.addEventListener('change', (e) => {
        document.querySelectorAll('.video-checkbox').forEach(c => {
            if (c.closest('tr').style.display !== 'none') {
                c.checked = e.target.checked;
                e.target.checked ? selectedVideoIds.add(c.dataset.videoId) : selectedVideoIds.delete(c.dataset.videoId);
            }
        });
        document.getElementById('bulk-edit-bar').style.display = selectedVideoIds.size > 0 ? 'block' : 'none';
        document.getElementById('selection-counter').innerText = `${selectedVideoIds.size} video(s) selected`;
    });

    netlifyIdentity.on('login', user => { currentUser = user; appContainer.style.display = 'flex'; initColumnToggles(); fetchFolders(user); });
    netlifyIdentity.on('logout', () => location.reload());
    if (netlifyIdentity.currentUser()) { currentUser = netlifyIdentity.currentUser(); appContainer.style.display = 'flex'; initColumnToggles(); fetchFolders(currentUser); }
});

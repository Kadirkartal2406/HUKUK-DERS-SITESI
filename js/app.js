/* js/app.js */

import * as db from './db.js';
import { extractTextFromPdf } from './pdf-helper.js';
import * as ai from './gemini.js';
import * as ui from './ui.js';

// Application State
let courses = [];
let activeQuiz = null;
let currentQuestionIndex = 0;
let quizScore = 0;
let quizAnswers = []; // to track user's choices
let chatHistory = [];
let debounceSaveTimer = null;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Initialize IndexedDB
    await db.initDb();
    
    // 2. Load API key settings
    ui.updateApiKeyBadgeStatus();
    
    // 3. Set up event listeners
    initEventListeners();
    
    // 4. Initial load of courses & stats
    await refreshDashboard();
    
    // 5. Render first year tab
    renderCoursesGridByTab(1);
    
    ui.showToast('Çalışma platformu başarıyla yüklendi.');
  } catch (error) {
    console.error('App init error:', error);
    ui.showToast('Veritabanı yüklenemedi. Lütfen sayfayı yenileyin.', 'error');
  }
});

// Event Listeners Registration
function initEventListeners() {
  // SPA Sidebar Routing
  document.querySelectorAll('.sidebar-menu .menu-item').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = link.dataset.page;
      switchPage(pageId, link);
    });
  });

  // Dashboard Tabs
  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const year = parseInt(tab.dataset.year);
      renderCoursesGridByTab(year);
    });
  });

  // Add Custom Course Modal triggers
  document.getElementById('add-course-btn').addEventListener('click', () => {
    openModal('add-course-modal');
  });
  
  document.getElementById('close-add-course-modal').addEventListener('click', () => {
    closeModal('add-course-modal');
  });
  
  document.getElementById('cancel-add-course-btn').addEventListener('click', () => {
    closeModal('add-course-modal');
  });

  document.getElementById('add-course-form').addEventListener('submit', handleAddCourse);

  // Gemini API Key Modal triggers
  document.getElementById('api-key-setup-btn').addEventListener('click', () => {
    const keyField = document.getElementById('api-key-input');
    keyField.value = ai.getApiKey();
    const modelSelect = document.getElementById('api-model-select');
    if (modelSelect) {
      modelSelect.value = ai.getApiModel();
    }
    openModal('api-key-modal');
  });
  
  document.getElementById('close-api-key-modal').addEventListener('click', () => {
    closeModal('api-key-modal');
  });
  
  document.getElementById('save-api-key-btn').addEventListener('click', () => {
    const key = document.getElementById('api-key-input').value;
    ai.setApiKey(key);
    const modelSelect = document.getElementById('api-model-select');
    if (modelSelect) {
      ai.setApiModel(modelSelect.value);
    }
    ui.updateApiKeyBadgeStatus();
    closeModal('api-key-modal');
    ui.showToast('Gemini API ayarları başarıyla güncellendi.');
  });

  const testBtn = document.getElementById('test-api-key-btn');
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const keyInput = document.getElementById('api-key-input').value;
      const resultDiv = document.getElementById('api-test-results');
      if (!resultDiv) return;

      resultDiv.style.display = 'block';
      resultDiv.textContent = 'Bağlantı kuruluyor ve model listesi çekiliyor...';

      try {
        const models = await ai.testApiKeyAndListModels(keyInput);
        if (models.length === 0) {
          resultDiv.textContent = 'Bağlantı başarılı fakat bu anahtara tanımlı model bulunamadı!';
          return;
        }

        const listStr = models.map(m => {
          const shortName = m.name.replace('models/', '');
          const supportsGenerate = m.supportedGenerationMethods?.includes('generateContent') ? '✓' : '✗';
          return `${shortName} [Content: ${supportsGenerate}]`;
        }).join('\n');

        resultDiv.innerHTML = `<span style="color:#10b981;font-weight:bold;">✓ Bağlantı Başarılı!</span>\n\nYetkili Modeller:\n${listStr}`;
      } catch (err) {
        resultDiv.innerHTML = `<span style="color:#ef4444;font-weight:bold;">✗ Bağlantı Başarısız!</span>\n\nHata: ${err.message}`;
      }
    });
  }
  
  document.getElementById('clear-api-key-btn').addEventListener('click', () => {
    ai.setApiKey('');
    ui.updateApiKeyBadgeStatus();
    closeModal('api-key-modal');
    ui.showToast('Gemini API Anahtarı silindi.', 'warning');
  });

  // Note actions
  document.getElementById('create-note-btn').addEventListener('click', handleCreateNote);
  document.getElementById('note-title-field').addEventListener('input', handleNoteContentChange);
  document.getElementById('note-editor-body').addEventListener('input', handleNoteContentChange);
  
  // Editor Toolbar basic commands
  document.querySelectorAll('.toolbar-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      const val = btn.dataset.val || null;
      document.execCommand(cmd, false, val);
      document.getElementById('note-editor-body').focus();
      handleNoteContentChange();
    });
  });

  // Manual Note Save Button
  document.getElementById('editor-save-btn').addEventListener('click', () => {
    saveActiveNoteImmediate();
  });

  // PDF Viewer Close
  document.getElementById('close-pdf-btn').addEventListener('click', () => {
    ui.setActivePdf(null);
  });

  // PDF Drag & Drop Upload
  const dropzone = document.getElementById('pdf-dropzone');
  const fileInput = document.getElementById('pdf-file-input');

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handlePdfFileSelect);

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--accent-gold)';
    dropzone.style.backgroundColor = 'var(--accent-gold-glow)';
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'var(--border-color)';
    dropzone.style.backgroundColor = 'transparent';
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border-color)';
    dropzone.style.backgroundColor = 'transparent';
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processPdfUpload(files[0]);
    }
  });

  // Chat/Sources panel quiz generation redirection
  document.getElementById('chat-sources-quiz-btn').addEventListener('click', () => {
    // Jump directly to quiz page
    document.getElementById('menu-quiz').click();
    // Pre-select AI generation
    document.getElementById('quiz-source-ai-btn').click();
  });

  // Chat message clearing
  document.getElementById('clear-chat-btn').addEventListener('click', () => {
    chatHistory = [];
    const chatBox = document.getElementById('chat-messages-box');
    chatBox.innerHTML = `
      <div class="message ai">
        <div class="message-avatar">AI</div>
        <div class="message-content">
          <div class="message-bubble">
            <p>Merhaba Neslihan! Sohbet geçmişini temizledim. Seçtiğin kaynaklar doğrultusunda sormak istediğin yeni hukuki konuları yazabilirsin.</p>
          </div>
        </div>
      </div>
    `;
  });

  // Chat input field auto-resize & key actions
  const chatInput = document.getElementById('chat-input-field');
  const chatSubmitBtn = document.getElementById('chat-submit-btn');

  chatInput.addEventListener('input', () => {
    chatSubmitBtn.disabled = !chatInput.value.trim();
    chatInput.style.height = '46px';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (chatInput.value.trim()) {
        document.getElementById('chat-form-element').dispatchEvent(new Event('submit'));
      }
    }
  });

  document.getElementById('chat-form-element').addEventListener('submit', handleChatSubmit);

  // Quiz Setup View Selectors
  document.getElementById('quiz-source-ai-btn').addEventListener('click', () => {
    document.getElementById('quiz-source-ai-btn').classList.add('active');
    document.getElementById('quiz-source-pdf-btn').classList.remove('active');
    document.getElementById('quiz-source-manual-btn').classList.remove('active');
    document.getElementById('quiz-setup-ai-controls').style.display = 'block';
    document.getElementById('quiz-setup-pdf-controls').style.display = 'none';
    document.getElementById('quiz-setup-manual-controls').style.display = 'none';
  });

  document.getElementById('quiz-source-pdf-btn').addEventListener('click', () => {
    document.getElementById('quiz-source-pdf-btn').classList.add('active');
    document.getElementById('quiz-source-ai-btn').classList.remove('active');
    document.getElementById('quiz-source-manual-btn').classList.remove('active');
    document.getElementById('quiz-setup-pdf-controls').style.display = 'block';
    document.getElementById('quiz-setup-ai-controls').style.display = 'none';
    document.getElementById('quiz-setup-manual-controls').style.display = 'none';
  });

  document.getElementById('quiz-source-manual-btn').addEventListener('click', () => {
    document.getElementById('quiz-source-manual-btn').classList.add('active');
    document.getElementById('quiz-source-ai-btn').classList.remove('active');
    document.getElementById('quiz-source-pdf-btn').classList.remove('active');
    document.getElementById('quiz-setup-manual-controls').style.display = 'block';
    document.getElementById('quiz-setup-ai-controls').style.display = 'none';
    document.getElementById('quiz-setup-pdf-controls').style.display = 'none';
  });

  document.getElementById('start-ai-quiz-generation').addEventListener('click', handleAiQuizGeneration);
  document.getElementById('start-pdf-quiz-conversion').addEventListener('click', handlePdfQuizConversion);
  document.getElementById('start-local-pdf-quiz').addEventListener('click', handleLocalPdfQuizConversion);
  document.getElementById('start-manual-quiz').addEventListener('click', handleManualQuizImport);

  // Active quiz controls
  document.getElementById('quiz-next-btn').addEventListener('click', handleQuizNext);
  document.getElementById('quiz-quit-btn').addEventListener('click', () => {
    if (confirm('Testi yarıda kesip bitirmek istediğinizden emin misiniz?')) {
      endQuizAndShowResults();
    }
  });

  document.getElementById('results-restart-btn').addEventListener('click', restartQuiz);
  document.getElementById('results-close-btn').addEventListener('click', () => {
    document.getElementById('menu-dashboard').click();
  });

  // Mobile Hamburger Toggle
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (toggleBtn && sidebar && overlay) {
    const toggleSidebar = () => {
      const isOpen = sidebar.classList.contains('mobile-active');
      if (isOpen) {
        sidebar.classList.remove('mobile-active');
        overlay.style.display = 'none';
      } else {
        sidebar.classList.add('mobile-active');
        overlay.style.display = 'block';
      }
    };

    toggleBtn.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', toggleSidebar);

    // Close menu when navigation items are clicked on mobile
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
      item.addEventListener('click', () => {
        if (sidebar.classList.contains('mobile-active')) {
          sidebar.classList.remove('mobile-active');
          overlay.style.display = 'none';
        }
      });
    });
  }
}

// SPA Routing switcher
function switchPage(pageId, activeLink) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  // Show selected page
  const selectedPage = document.getElementById(pageId);
  if (selectedPage) {
    selectedPage.classList.add('active');
  }

  // Handle active link highlights
  document.querySelectorAll('.sidebar-menu .menu-item').forEach(link => {
    link.classList.remove('active');
  });
  activeLink.classList.add('active');

  // Trigger contextual page loading
  if (pageId === 'notebook-page') {
    loadNotebookPanel();
  } else if (pageId === 'chat-page') {
    loadChatPanel();
  } else if (pageId === 'quiz-page') {
    loadQuizPanel();
  } else if (pageId === 'dashboard-page') {
    refreshDashboard();
  }
}

// Modal open/close helpers
function openModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove('active');
}

// Refresh Dashboard Data
async function refreshDashboard() {
  courses = await db.getCourses();
  const stats = await db.getGlobalStats();
  ui.renderDashboardStats(stats);
  renderCoursesGridByTab(ui.activeYearTab);
}

// Render grid based on year
async function renderCoursesGridByTab(year) {
  ui.renderCoursesGrid(courses, year, handleCourseSelection);
  
  // Fill counts async on the generated cards
  courses.forEach(async (c) => {
    if (c.year === year) {
      const notes = await db.getNotes(c.id);
      const pdfs = await db.getPdfs(c.id);
      const nSpan = document.getElementById(`card-note-count-${c.id}`);
      const pSpan = document.getElementById(`card-pdf-count-${c.id}`);
      if (nSpan) nSpan.textContent = notes.length;
      if (pSpan) pSpan.textContent = pdfs.length;
    }
  });
}

// Handle course clicked from dashboard
function handleCourseSelection(course) {
  ui.setActiveCourse(course);
  
  // Redirect to Notebook immediately
  const notebookLink = document.getElementById('menu-notebook');
  switchPage('notebook-page', notebookLink);
}

// Add Custom Course submit
async function handleAddCourse(e) {
  e.preventDefault();
  const name = document.getElementById('course-name-input').value;
  const year = parseInt(document.getElementById('course-year-input').value);
  
  const id = name.toLowerCase()
                 .replace(/[^a-z0-9]/g, '-')
                 .replace(/-+/g, '-')
                 .trim();

  const newCourse = { id, name, year };

  try {
    await db.addCourse(newCourse);
    closeModal('add-course-modal');
    document.getElementById('add-course-form').reset();
    ui.showToast(`${name} dersi başarıyla eklendi.`);
    await refreshDashboard();
  } catch (error) {
    ui.showToast('Ders eklenirken bir hata oluştu.', 'error');
  }
}

// --- NOTEBOOK SCREEN ACTIONS ---

async function loadNotebookPanel() {
  if (!ui.activeCourse) return;
  await refreshNotebookSidebar();
  ui.setActiveNote(null);
  ui.setActivePdf(null);
}

async function refreshNotebookSidebar() {
  const notes = await db.getNotes(ui.activeCourse.id);
  const pdfs = await db.getPdfs(ui.activeCourse.id);

  // Render Notes list
  const notesArea = document.getElementById('notes-list-area');
  notesArea.innerHTML = '';
  if (notes.length === 0) {
    notesArea.innerHTML = '<li class="list-item" style="cursor:default; text-align:center;">Henüz not bulunmuyor.</li>';
  } else {
    notes.forEach(note => {
      const li = document.createElement('li');
      li.className = 'list-item';
      li.dataset.id = note.id;
      if (ui.activeNote && ui.activeNote.id === note.id) li.classList.add('active');
      
      li.innerHTML = `
        <span class="list-item-title">${note.title}</span>
        <div class="list-item-actions">
          <button class="list-action-btn note-del-btn" title="Sil">
            <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m9.03-9.25 1.07 10.53a1.88 1.88 0 0 1-1.87 2.07H5.06a1.88 1.88 0 0 1-1.87-2.07L4.25 4.75h15.5Z"/></svg>
          </button>
        </div>
      `;

      li.addEventListener('click', (e) => {
        if (e.target.closest('.note-del-btn')) {
          e.stopPropagation();
          handleDeleteNote(note.id);
        } else {
          ui.setActiveNote(note);
        }
      });
      notesArea.appendChild(li);
    });
  }

  // Render PDFs list
  const pdfsArea = document.getElementById('pdfs-list-area');
  pdfsArea.innerHTML = '';
  if (pdfs.length === 0) {
    pdfsArea.innerHTML = '<li class="list-item" style="cursor:default; text-align:center;">Henüz PDF yüklenmemiş.</li>';
  } else {
    pdfs.forEach(pdf => {
      const li = document.createElement('li');
      li.className = 'list-item';
      li.dataset.id = pdf.id;
      if (ui.activePdf && ui.activePdf.id === pdf.id) li.classList.add('active');

      li.innerHTML = `
        <span class="list-item-title">${pdf.name}</span>
        <div class="list-item-actions">
          <button class="list-action-btn pdf-del-btn" title="Sil">
            <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m9.03-9.25 1.07 10.53a1.88 1.88 0 0 1-1.87 2.07H5.06a1.88 1.88 0 0 1-1.87-2.07L4.25 4.75h15.5Z"/></svg>
          </button>
        </div>
      `;

      li.addEventListener('click', (e) => {
        if (e.target.closest('.pdf-del-btn')) {
          e.stopPropagation();
          handleDeletePdf(pdf.id);
        } else {
          ui.setActivePdf(pdf);
        }
      });
      pdfsArea.appendChild(li);
    });
  }
}

async function handleCreateNote() {
  const noteId = `note-${Date.now()}`;
  const newNote = {
    id: noteId,
    courseId: ui.activeCourse.id,
    title: 'Yeni Ders Notu',
    content: 'Bu alana notlarınızı yazın...',
    updatedAt: Date.now()
  };

  try {
    await db.saveNote(newNote);
    await refreshNotebookSidebar();
    ui.setActiveNote(newNote);
    ui.showToast('Yeni not taslağı oluşturuldu.');
  } catch (error) {
    ui.showToast('Not oluşturulurken bir hata meydana geldi.', 'error');
  }
}

// Debounced Content Change
function handleNoteContentChange() {
  if (!ui.activeNote) return;
  document.getElementById('editor-save-status').textContent = 'Değişiklikler kaydediliyor...';
  
  clearTimeout(debounceSaveTimer);
  debounceSaveTimer = setTimeout(() => {
    saveActiveNoteImmediate();
  }, 1200);
}

async function saveActiveNoteImmediate() {
  if (!ui.activeNote) return;

  const title = document.getElementById('note-title-field').value || 'Başlıksız Not';
  const content = document.getElementById('note-editor-body').innerHTML;
  
  const updatedNote = {
    ...ui.activeNote,
    title,
    content,
    updatedAt: Date.now()
  };

  try {
    await db.saveNote(updatedNote);
    ui.activeNote.title = title;
    ui.activeNote.content = content;
    document.getElementById('editor-save-status').textContent = 'Tüm değişiklikler kaydedildi';
    
    // Update sidebar name without reloading the whole list
    const li = document.querySelector(`#notes-list-area .list-item[data-id="${updatedNote.id}"] .list-item-title`);
    if (li) li.textContent = title;
  } catch (error) {
    document.getElementById('editor-save-status').textContent = 'Kaydedilemedi!';
  }
}

async function handleDeleteNote(id) {
  if (confirm('Bu ders notunu silmek istediğinizden emin misiniz?')) {
    try {
      await db.deleteNote(id);
      if (ui.activeNote && ui.activeNote.id === id) {
        ui.setActiveNote(null);
      }
      await refreshNotebookSidebar();
      ui.showToast('Ders notu silindi.', 'warning');
    } catch (error) {
      ui.showToast('Not silinirken hata oluştu.', 'error');
    }
  }
}

// PDF processing
function handlePdfFileSelect(e) {
  const file = e.target.files[0];
  if (file && file.type === 'application/pdf') {
    processPdfUpload(file);
  } else {
    ui.showToast('Lütfen geçerli bir PDF belgesi yükleyin.', 'error');
  }
}

async function processPdfUpload(file) {
  const statusField = document.getElementById('editor-save-status');
  statusField.textContent = 'PDF Metni Ayıklanıyor...';
  ui.showToast('PDF yükleme başladı, metin ayıklanıyor...');

  const reader = new FileReader();
  reader.onload = async function() {
    const arrayBuffer = this.result;
    
    try {
      // Extract text in browser using PDF.js worker
      const extractedText = await extractTextFromPdf(arrayBuffer, (page, total) => {
        statusField.textContent = `PDF okunuyor: Sayfa ${page} / ${total}`;
      });

      const pdfId = `pdf-${Date.now()}`;
      const newPdf = {
        id: pdfId,
        courseId: ui.activeCourse.id,
        name: file.name,
        size: file.size,
        textContent: extractedText,
        uploadedAt: Date.now()
      };

      await db.savePdf(newPdf);
      statusField.textContent = 'PDF başarıyla kaydedildi';
      ui.showToast(`${file.name} başarıyla yüklendi ve indekslendi.`);
      await refreshNotebookSidebar();
    } catch (error) {
      console.error(error);
      statusField.textContent = 'Hata oluştu!';
      ui.showToast('PDF okunurken bir hata oluştu: ' + error.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function handleDeletePdf(id) {
  if (confirm('Bu PDF belgesini platformdan silmek istediğinizden emin misiniz?')) {
    try {
      await db.deletePdf(id);
      if (ui.activePdf && ui.activePdf.id === id) {
        ui.setActivePdf(null);
      }
      await refreshNotebookSidebar();
      ui.showToast('PDF dökümanı silindi.', 'warning');
    } catch (error) {
      ui.showToast('PDF silinirken hata oluştu.', 'error');
    }
  }
}

// --- CHAT SCREEN ACTIONS (NOTEBOOKLM SIMULATION) ---

async function loadChatPanel() {
  if (!ui.activeCourse) return;

  const notes = await db.getNotes(ui.activeCourse.id);
  const pdfs = await db.getPdfs(ui.activeCourse.id);

  // Render PDFs in sidebar checklist
  const pdfList = document.getElementById('chat-sources-pdfs-list');
  pdfList.innerHTML = '';
  if (pdfs.length === 0) {
    pdfList.innerHTML = '<li class="text-muted" style="font-size:12px;">PDF bulunamadı.</li>';
  } else {
    pdfs.forEach(pdf => {
      const li = document.createElement('li');
      li.innerHTML = `
        <label class="source-checkbox-item">
          <input type="checkbox" class="source-checkbox" data-type="pdf" data-id="${pdf.id}" checked>
          <div class="source-name-wrap">
            <span class="source-name-text">${pdf.name}</span>
            <span class="source-meta-text">${Math.round(pdf.size / 1024)} KB • PDF</span>
          </div>
        </label>
      `;
      pdfList.appendChild(li);
    });
  }

  // Render Notes in sidebar checklist
  const notesList = document.getElementById('chat-sources-notes-list');
  notesList.innerHTML = '';
  if (notes.length === 0) {
    notesList.innerHTML = '<li class="text-muted" style="font-size:12px;">Not bulunamadı.</li>';
  } else {
    notes.forEach(note => {
      const li = document.createElement('li');
      li.innerHTML = `
        <label class="source-checkbox-item">
          <input type="checkbox" class="source-checkbox" data-type="note" data-id="${note.id}" checked>
          <div class="source-name-wrap">
            <span class="source-name-text">${note.title}</span>
            <span class="source-meta-text">Ders Notu</span>
          </div>
        </label>
      `;
      notesList.appendChild(li);
    });
  }

  // Listen checklist changes to update counter
  document.querySelectorAll('.source-checkbox').forEach(cb => {
    cb.addEventListener('change', updateActiveSourcesCount);
  });

  updateActiveSourcesCount();
}

function updateActiveSourcesCount() {
  const count = document.querySelectorAll('.source-checkbox:checked').length;
  document.getElementById('chat-active-sources-count').textContent = `${count} kaynak aktif`;
}

async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input-field');
  const query = input.value.trim();
  if (!query) return;

  // Clear input area
  input.value = '';
  input.style.height = '46px';
  document.getElementById('chat-submit-btn').disabled = true;

  // 1. Check API Key
  if (!ai.hasApiKey()) {
    ui.showToast('Lütfen önce Gemini API Anahtarınızı yapılandırın.', 'warning');
    document.getElementById('api-key-setup-btn').click();
    return;
  }

  // 2. Aggregate checked sources contents
  let sourcesContent = '';
  const selectedCheckboxes = document.querySelectorAll('.source-checkbox:checked');
  
  if (selectedCheckboxes.length === 0) {
    ui.showToast('Lütfen yapay zekanın kullanması için en az 1 kaynak döküman seçin.', 'warning');
    return;
  }

  for (const cb of selectedCheckboxes) {
    const id = cb.dataset.id;
    const type = cb.dataset.type;
    if (type === 'pdf') {
      const pdf = await db.getPdf(id);
      if (pdf) sourcesContent += `[PDF Dosyası: ${pdf.name}]\n${pdf.textContent}\n\n`;
    } else {
      const note = await db.getNote(id);
      if (note) {
        // Strip html tags from note content for cleaner text input
        const plainText = note.content.replace(/<[^>]*>/g, ' ');
        sourcesContent += `[Not: ${note.title}]\n${plainText}\n\n`;
      }
    }
  }

  // 3. Append user message to chat UI
  appendChatMessage('user', query);
  
  // Save query to history
  chatHistory.push({ role: 'user', text: query });

  // 4. Append typing indicator
  const chatBox = document.getElementById('chat-messages-box');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message ai typing-placeholder';
  typingDiv.innerHTML = `
    <div class="message-avatar">AI</div>
    <div class="message-content">
      <div class="message-bubble">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
  `;
  chatBox.appendChild(typingDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    // 5. Send to Gemini
    const response = await ai.chatWithSources(chatHistory, sourcesContent);
    
    // Remove typing indicator
    typingDiv.remove();

    // 6. Display AI bubble
    appendChatMessage('ai', response);
    chatHistory.push({ role: 'ai', text: response });
  } catch (error) {
    typingDiv.remove();
    appendChatMessage('ai', `Üzgünüm Neslihan, cevap üretilirken bir hata ile karşılaşıldı: ${error.message}`);
    ui.showToast('Sohbet yanıtı alınamadı.', 'error');
  }
}

function appendChatMessage(sender, text) {
  const chatBox = document.getElementById('chat-messages-box');
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;

  // Simple Markdown-like formatting helper for bubble
  let formattedText = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold formatting
    .replace(/\n/g, '<br>'); // Line breaks

  msgDiv.innerHTML = `
    <div class="message-avatar">${sender === 'user' ? 'U' : 'AI'}</div>
    <div class="message-content">
      <div class="message-bubble">
        <p>${formattedText}</p>
      </div>
      <span class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
    </div>
  `;

  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// --- AI QUIZ MODULE ACTIONS ---

async function loadQuizPanel() {
  if (!ui.activeCourse) return;
  
  // Show Setup panel, hide quiz screens
  document.getElementById('quiz-setup-panel').style.display = 'block';
  document.getElementById('quiz-solving-panel').style.display = 'none';
  document.getElementById('quiz-results-panel').style.display = 'none';

  // Pre-select AI generation tab by default
  document.getElementById('quiz-source-ai-btn').click();

  // Populate PDF dropdown
  try {
    const pdfs = await db.getPdfs(ui.activeCourse.id);
    const pdfSelect = document.getElementById('quiz-pdf-select');
    pdfSelect.innerHTML = '';
    
    if (pdfs.length === 0) {
      pdfSelect.innerHTML = '<option value="">-- Yüklenmiş PDF Bulunmuyor --</option>';
    } else {
      pdfs.forEach(pdf => {
        const opt = document.createElement('option');
        opt.value = pdf.id;
        opt.textContent = pdf.name;
        pdfSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to load PDFs for quiz dropdown:', err);
  }

  // Render saved quiz banks
  await renderSavedQuizBanks();
}

async function handleAiQuizGeneration() {
  if (!ai.hasApiKey()) {
    ui.showToast('Lütfen önce Gemini API Anahtarınızı yapılandırın.', 'warning');
    document.getElementById('api-key-setup-btn').click();
    return;
  }

  // 1. Gather all course notes & PDFs
  const notes = await db.getNotes(ui.activeCourse.id);
  const pdfs = await db.getPdfs(ui.activeCourse.id);

  let sourceText = '';
  notes.forEach(note => {
    const plain = note.content.replace(/<[^>]*>/g, ' ');
    sourceText += `Not: ${note.title}\nİçerik: ${plain}\n\n`;
  });
  pdfs.forEach(pdf => {
    sourceText += `Döküman: ${pdf.name}\nİçerik: ${pdf.textContent}\n\n`;
  });

  if (!sourceText.trim()) {
    ui.showToast('Dersinize ait soru oluşturabilecek hiçbir not veya PDF bulunmamaktadır. Lütfen önce kaynak yükleyin.', 'error');
    return;
  }

  // Show loading indicator
  const startBtn = document.getElementById('start-ai-quiz-generation');
  const originalText = startBtn.textContent;
  startBtn.textContent = 'Sorular Üretiliyor...';
  startBtn.disabled = true;

  const count = parseInt(document.getElementById('quiz-question-count').value);

  try {
    const parsedQuestions = await ai.generateQuizFromSources(sourceText, count);
    
    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      throw new Error('Soru formatı geçersiz.');
    }

    // Ask to save before starting
    await promptSaveQuizBank(parsedQuestions, `AI - ${ui.activeCourse.name} - ${new Date().toLocaleDateString('tr-TR')}`);
    startQuizSession(parsedQuestions);
  } catch (error) {
    ui.showToast('Yapay zeka soru üretemedi: ' + error.message, 'error');
  } finally {
    startBtn.textContent = originalText;
    startBtn.disabled = false;
  }
}

async function handlePdfQuizConversion() {
  if (!ai.hasApiKey()) {
    ui.showToast('Lütfen önce Gemini API Anahtarınızı yapılandırın.', 'warning');
    document.getElementById('api-key-setup-btn').click();
    return;
  }

  const pdfId = document.getElementById('quiz-pdf-select').value;
  if (!pdfId) {
    ui.showToast('Lütfen listeden soru dökümanı içeren bir PDF seçin.', 'warning');
    return;
  }

  const convertBtn = document.getElementById('start-pdf-quiz-conversion');
  const originalText = convertBtn.textContent;
  convertBtn.textContent = 'Sorular Çözülüyor...';
  convertBtn.disabled = true;

  try {
    const pdf = await db.getPdf(pdfId);
    if (!pdf || !pdf.textContent.trim()) {
      throw new Error('Seçilen PDF dökümanının metin içeriği okunamadı.');
    }

    const parsedQuestions = await ai.convertQuestionPdfToQuiz(pdf.textContent);
    
    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      throw new Error('Yapay zeka PDF\'ten çözülebilir soru çıkaramadı.');
    }

    // Ask to save before starting
    await promptSaveQuizBank(parsedQuestions, pdf.name.replace('.pdf', '').replace('.PDF', ''));
    startQuizSession(parsedQuestions);
    ui.showToast(`${parsedQuestions.length} soru PDF'ten interaktif sınava dönüştürüldü.`);
  } catch (error) {
    ui.showToast('Hata: ' + error.message, 'error');
  } finally {
    convertBtn.textContent = originalText;
    convertBtn.disabled = false;
  }
}

/**
 * LOCAL (AI-free) fast quiz extraction from PDF text.
 * Tries multiple common Turkish question formats.
 */
async function handleLocalPdfQuizConversion() {
  const pdfId = document.getElementById('quiz-pdf-select').value;
  if (!pdfId) {
    ui.showToast('Lütfen listeden bir PDF seçin.', 'warning');
    return;
  }

  const pdf = await db.getPdf(pdfId);
  if (!pdf || !pdf.textContent.trim()) {
    ui.showToast('PDF metin içeriği okunamadı.', 'error');
    return;
  }

  const parsedQuestions = parseLocalQuestions(pdf.textContent);

  if (parsedQuestions.length === 0) {
    ui.showToast(
      'Bu PDF\'te standart formatlı soru bulunamadı. AI dönüştürücüyü deneyin.',
      'warning'
    );
    return;
  }

  await promptSaveQuizBank(parsedQuestions, pdf.name.replace(/\.pdf$/i, '') + ' (Hızlı)');
  startQuizSession(parsedQuestions);
  ui.showToast(`⚡ ${parsedQuestions.length} soru AI olmadan anında çözüldü!`);
}

// Manual Text Quiz Import Parser
function handleManualQuizImport() {
  const rawText = document.getElementById('quiz-manual-paste-area').value.trim();
  if (!rawText) {
    ui.showToast('Lütfen önce çözülecek soru metnini yapıştırın.', 'warning');
    return;
  }

  try {
    const parsedQuestions = parseManualQuestions(rawText);
    if (parsedQuestions.length === 0) {
      throw new Error('Şablon eşleşmedi. Soruları format kurallarına uygun yazdığınızdan emin olun.');
    }
    
    startQuizSession(parsedQuestions);
    ui.showToast(`${parsedQuestions.length} soru başarıyla içeri aktarıldı ve test başladı.`);
  } catch (error) {
    ui.showToast(error.message, 'error');
  }
}

/**
 * Custom Parser for manual pasted text.
 * Expects blocks like:
 * Soru 1: [Text]
 * A) [Option]
 * B) [Option]
 * C) [Option]
 * D) [Option]
 * Cevap: [A/B/C/D]
 * Açıklama: [Explanation]
 */
function parseManualQuestions(text) {
  // Split into question blocks (starts with "Soru " or "soru ")
  const blocks = text.split(/(?=Soru\s*\d+\s*:|soru\s*\d+\s*:)/gi);
  const questionsList = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length < 5) continue;

    let questionText = '';
    let options = [];
    let answerIndex = -1;
    let explanation = 'Açıklama bulunmuyor.';
    let readingQuestion = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse question header
      if (i === 0) {
        questionText = line.replace(/Soru\s*\d+\s*:\s*/i, '');
        continue;
      }

      // Check for options
      const optMatch = line.match(/^([A-D])\s*[\)\.-]\s*(.+)/i);
      if (optMatch) {
        readingQuestion = false;
        options.push(optMatch[2]);
        continue;
      }

      // Parse Answer
      const ansMatch = line.match(/^Cevap\s*:\s*([A-D])/i);
      if (ansMatch) {
        readingQuestion = false;
        const letter = ansMatch[1].toUpperCase();
        answerIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
        continue;
      }

      // Parse Explanation
      const expMatch = line.match(/^Açıklama\s*:\s*(.+)/i);
      if (expMatch) {
        readingQuestion = false;
        explanation = expMatch[1] + lines.slice(i+1).join(' ');
        break; // Stop loop since explanation consumes the rest
      }

      // If we are still in question text and didn't match anything else, append
      if (readingQuestion) {
        questionText += '\n' + line;
      }
    }

    if (questionText && options.length >= 2 && answerIndex !== -1) {
      questionsList.push({
        question: questionText,
        options: options,
        answerIndex: answerIndex,
        explanation: explanation
      });
    }
  }

  return questionsList;
}

/**
 * Robust multi-format local parser for Turkish exam PDFs.
 * Handles: numbered questions (1. / 1- / Soru 1:), A/B/C/D options
 * in multiple styles, inline answer keys and cevap anahtarı tables.
 * Does NOT require AI - works instantly.
 */
function parseLocalQuestions(text) {
  // --- Step 1: Detect answer key table (e.g. "1-A  2-B  3-C") at end of text ---
  const answerKey = {};
  const keyTableRe = /(\d+)\s*[-\.)\s]\s*([A-Ea-e])\b/g;
  let keyMatch;
  // Only harvest from last 3000 chars (likely answer key section)
  const tail = text.slice(-3000);
  while ((keyMatch = keyTableRe.exec(tail)) !== null) {
    answerKey[parseInt(keyMatch[1])] = keyMatch[2].toUpperCase();
  }

  // --- Step 2: Split text into question blocks ---
  // Support: "1." "1-" "1)" "Soru 1:" "SORU 1." at line start
  const blockSplitRe = /(?:^|\n)\s*(?:SORU\s*)?(\d{1,3})\s*[.\-\):](?!\d)/gi;
  const blocks = [];
  let lastIndex = 0;
  let lastNum = null;
  const matches = [...text.matchAll(blockSplitRe)];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const num = parseInt(m[1]);
    if (lastNum !== null) {
      blocks.push({ num: lastNum, text: text.slice(lastIndex, m.index).trim() });
    }
    lastNum = num;
    lastIndex = m.index + m[0].length;
  }
  if (lastNum !== null) {
    blocks.push({ num: lastNum, text: text.slice(lastIndex).trim() });
  }

  // --- Step 3: Parse each block ---
  const questions = [];

  for (const block of blocks) {
    const lines = block.text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 3) continue;

    let questionLines = [];
    let options = [];
    let answerIndex = -1;
    let explanation = '';

    for (const line of lines) {
      // Option line: A) A. A- (A) [A]
      const optMatch = line.match(/^[\[\(]?([A-Ea-e])[\]\).\-\s]\s*(.+)/);
      if (optMatch && options.length < 5) {
        options.push(optMatch[2].trim());
        continue;
      }

      // Inline answer: "Cevap: B" "Yanıt: C" "Doğru: A"
      const ansMatch = line.match(/^(?:cevap|yan[iı]t|do[gğ]ru\s*(?:cevap)?)\s*[:\-]\s*([A-Ea-e])/i);
      if (ansMatch) {
        answerIndex = 'ABCDE'.indexOf(ansMatch[1].toUpperCase());
        continue;
      }

      // Explanation line
      const expMatch = line.match(/^(?:a[cç][iı]klama|gerek[cç]e)\s*[:\-]\s*(.+)/i);
      if (expMatch) {
        explanation = expMatch[1];
        continue;
      }

      // Still building question text
      if (options.length === 0) {
        questionLines.push(line);
      }
    }

    const questionText = questionLines.join(' ').trim();
    if (!questionText || options.length < 2) continue;

    // Try answer key table if no inline answer
    if (answerIndex === -1 && answerKey[block.num]) {
      answerIndex = 'ABCDE'.indexOf(answerKey[block.num]);
    }

    // Default to first option if still unknown (will show as ? in explanation)
    const finalAnswerIndex = answerIndex >= 0 ? answerIndex : 0;

    questions.push({
      question: `${block.num}. ${questionText}`,
      options: options.slice(0, 5),
      answerIndex: finalAnswerIndex,
      explanation: explanation ||
        (answerIndex >= 0
          ? `Doğru cevap: ${['A','B','C','D','E'][finalAnswerIndex]} şıkkıdır.`
          : 'Cevap anahtarı bu PDF\'te belirtilmemiş. AI dönüştürücü kullanarak detaylı açıklama alabilirsiniz.')
    });
  }

  return questions;
}

// Start active Quiz Session
function startQuizSession(questions) {
  activeQuiz = {
    id: `quiz-${Date.now()}`,
    courseId: ui.activeCourse.id,
    questions: questions,
    score: 0,
    maxScore: questions.length
  };

  currentQuestionIndex = 0;
  quizScore = 0;
  quizAnswers = Array(questions.length).fill(null);

  // Layout Toggle
  document.getElementById('quiz-setup-panel').style.display = 'none';
  document.getElementById('quiz-solving-panel').style.display = 'flex';
  document.getElementById('quiz-results-panel').style.display = 'none';

  renderQuizQuestion(0);
}

function renderQuizQuestion(index) {
  const q = activeQuiz.questions[index];
  
  // Progress & Scores
  document.getElementById('current-q-index').textContent = index + 1;
  document.getElementById('total-q-count').textContent = activeQuiz.questions.length;
  
  const percentage = (index / activeQuiz.questions.length) * 100;
  document.getElementById('quiz-progress-bar').style.width = `${percentage}%`;
  document.getElementById('quiz-score-badge').textContent = `Skor: ${quizScore} / ${activeQuiz.questions.length}`;

  // Content
  document.getElementById('active-q-text').innerHTML = q.question.replace(/\n/g, '<br>');
  
  const optionsArea = document.getElementById('active-q-options');
  optionsArea.innerHTML = '';
  
  const prefixes = ['A', 'B', 'C', 'D'];
  q.options.forEach((optText, optIdx) => {
    const li = document.createElement('li');
    li.className = 'option-item';
    li.innerHTML = `
      <span class="option-prefix">${prefixes[optIdx]}</span>
      <span class="option-text">${optText}</span>
    `;

    // Click handler for options
    li.addEventListener('click', () => handleOptionClick(optIdx));
    optionsArea.appendChild(li);
  });

  // Reset footer and explanation
  document.getElementById('active-q-explanation-box').style.display = 'none';
  const nextBtn = document.getElementById('quiz-next-btn');
  nextBtn.disabled = true;
  
  if (index === activeQuiz.questions.length - 1) {
    nextBtn.textContent = 'Sınavı Bitir';
  } else {
    nextBtn.textContent = 'Sonraki Soru';
  }
}

function handleOptionClick(selectedIdx) {
  // Lock click once answered
  if (quizAnswers[currentQuestionIndex] !== null) return;

  const q = activeQuiz.questions[currentQuestionIndex];
  quizAnswers[currentQuestionIndex] = selectedIdx;

  const optionElements = document.querySelectorAll('#active-q-options .option-item');
  const isCorrect = (selectedIdx === q.answerIndex);

  // Update styles
  optionElements.forEach((el, idx) => {
    if (idx === q.answerIndex) {
      el.classList.add('correct'); // Highlight green
    } else if (idx === selectedIdx && !isCorrect) {
      el.classList.add('wrong'); // Highlight red
    }
  });

  if (isCorrect) {
    quizScore++;
    ui.showToast('Doğru cevap!', 'success');
  } else {
    ui.showToast('Yanlış cevap.', 'error');
  }

  // Display explanation
  const expBox = document.getElementById('active-q-explanation-box');
  const expText = document.getElementById('active-q-explanation-text');
  
  expText.innerHTML = q.explanation.replace(/\n/g, '<br>');
  expBox.style.display = 'flex';

  // Update live score badge
  document.getElementById('quiz-score-badge').textContent = `Skor: ${quizScore} / ${activeQuiz.questions.length}`;

  // Enable Next button
  document.getElementById('quiz-next-btn').disabled = false;
}

function handleQuizNext() {
  currentQuestionIndex++;
  
  if (currentQuestionIndex < activeQuiz.questions.length) {
    renderQuizQuestion(currentQuestionIndex);
  } else {
    endQuizAndShowResults();
  }
}

async function endQuizAndShowResults() {
  activeQuiz.score = quizScore;
  activeQuiz.date = Date.now();

  try {
    // Save to Database history
    await db.saveQuiz(activeQuiz);
    
    // UI Updates
    document.getElementById('quiz-solving-panel').style.display = 'none';
    document.getElementById('quiz-results-panel').style.display = 'flex';

    document.getElementById('results-correct-count').textContent = quizScore;
    document.getElementById('results-wrong-count').textContent = activeQuiz.questions.length - quizScore;
    
    const finalPct = Math.round((quizScore / activeQuiz.questions.length) * 100);
    document.getElementById('results-percentage').textContent = `${finalPct}%`;

    const msgField = document.getElementById('results-message');
    if (finalPct >= 70) {
      msgField.textContent = 'Harika bir başarı Neslihan! Konuyu çok iyi pekiştirmişsin. Tebrikler 🎓';
    } else if (finalPct >= 40) {
      msgField.textContent = 'İyi bir deneme Neslihan! Yanlış yaptığın gerekçeleri not alarak biraz daha çalışmak iyi olabilir 📖';
    } else {
      msgField.textContent = 'Neslihan, bu ders için notları biraz daha detaylı okuyup tekrar soru çözmeyi deneyelim. Çalışmaya devam! 💪';
    }

    // Refresh Dashboard stats
    await refreshDashboard();
  } catch (error) {
    ui.showToast('Skor veritabanına yazılırken bir hata oluştu.', 'error');
  }
}

function restartQuiz() {
  if (activeQuiz && activeQuiz.questions) {
    startQuizSession(activeQuiz.questions);
  }
}

// --- QUIZ BANKS ---

/**
 * Shows a modal-like prompt asking the user to name & save the generated quiz bank.
 */
async function promptSaveQuizBank(questions, defaultName) {
  return new Promise((resolve) => {
    const modal = document.getElementById('save-bank-modal');
    const nameInput = document.getElementById('save-bank-name-input');
    const saveBtn = document.getElementById('save-bank-confirm-btn');
    const skipBtn = document.getElementById('save-bank-skip-btn');
    const countSpan = document.getElementById('save-bank-count');

    nameInput.value = defaultName || '';
    if (countSpan) countSpan.textContent = questions.length;

    modal.classList.add('active');

    const cleanup = () => {
      modal.classList.remove('active');
      saveBtn.removeEventListener('click', onSave);
      skipBtn.removeEventListener('click', onSkip);
    };

    const onSave = async () => {
      const name = nameInput.value.trim() || defaultName;
      const bank = {
        id: `bank-${Date.now()}`,
        courseId: ui.activeCourse.id,
        name,
        questions,
        createdAt: Date.now()
      };
      try {
        await db.saveQuizBank(bank);
        ui.showToast(`"${name}" soru bankası kaydedildi! 📚`);
      } catch (e) {
        ui.showToast('Banka kaydedilemedi: ' + e.message, 'error');
      }
      cleanup();
      resolve();
    };

    const onSkip = () => {
      cleanup();
      resolve();
    };

    saveBtn.addEventListener('click', onSave);
    skipBtn.addEventListener('click', onSkip);
  });
}

/**
 * Renders the saved quiz banks list inside quiz setup panel.
 */
async function renderSavedQuizBanks() {
  const container = document.getElementById('saved-banks-list');
  if (!container) return;

  try {
    const banks = await db.getQuizBanks(ui.activeCourse.id);
    container.innerHTML = '';

    if (banks.length === 0) {
      container.innerHTML = `
        <div class="empty-banks-msg">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>
          <p>Henüz bu ders için kayıtlı soru bankası yok.<br>Ürettiğiniz soruları kaydedin, burada çıksın!</p>
        </div>
      `;
      return;
    }

    banks.sort((a, b) => b.createdAt - a.createdAt).forEach(bank => {
      const card = document.createElement('div');
      card.className = 'bank-card';
      const dateStr = new Date(bank.createdAt).toLocaleDateString('tr-TR');
      card.innerHTML = `
        <div class="bank-card-info">
          <div class="bank-card-name">${bank.name}</div>
          <div class="bank-card-meta">${bank.questions.length} soru &bull; ${dateStr}</div>
        </div>
        <div class="bank-card-actions">
          <button class="btn btn-primary btn-sm bank-start-btn" data-id="${bank.id}">▶ Sınava Başla</button>
          <button class="btn btn-secondary btn-sm bank-del-btn" data-id="${bank.id}" title="Bankayı Sil">🗑</button>
        </div>
      `;

      card.querySelector('.bank-start-btn').addEventListener('click', () => startQuizFromBank(bank));
      card.querySelector('.bank-del-btn').addEventListener('click', () => handleDeleteQuizBank(bank.id, bank.name));
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Saved banks load error:', err);
  }
}

function startQuizFromBank(bank) {
  ui.showToast(`"${bank.name}" bankası başlatıldı!`);
  startQuizSession(bank.questions);
}

async function handleDeleteQuizBank(id, name) {
  if (confirm(`"${name}" soru bankasını silmek istediğinizden emin misiniz?`)) {
    try {
      await db.deleteQuizBank(id);
      ui.showToast('Soru bankası silindi.', 'warning');
      await renderSavedQuizBanks();
    } catch (err) {
      ui.showToast('Soru bankası silinemedi.', 'error');
    }
  }
}

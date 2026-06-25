/* js/ui.js */

import { getApiKey } from './gemini.js';

// Global variables for active items
export let activeCourse = null;
export let activeNote = null;
export let activePdf = null;
export let activeYearTab = 1;

export function setActiveCourse(course) {
  activeCourse = course;
  const tag = document.getElementById('active-course-tag');
  const display = document.getElementById('current-course-display');
  
  if (course) {
    tag.style.display = 'inline-block';
    tag.textContent = `${course.year}. Sınıf`;
    display.textContent = course.name;
    
    // Enable study panels
    document.getElementById('notebook-empty-view').style.display = 'none';
    document.getElementById('notebook-main-view').style.display = 'flex';
    
    document.getElementById('chat-empty-view').style.display = 'none';
    document.getElementById('chat-main-view').style.display = 'flex';
    
    document.getElementById('quiz-empty-view').style.display = 'none';
    document.getElementById('quiz-main-view').style.display = 'flex';
  } else {
    tag.style.display = 'none';
    display.textContent = 'Çukurova Hukuk Platformu';
    
    // Disable study panels, show placeholders
    document.getElementById('notebook-empty-view').style.display = 'block';
    document.getElementById('notebook-main-view').style.display = 'none';
    
    document.getElementById('chat-empty-view').style.display = 'block';
    document.getElementById('chat-main-view').style.display = 'none';
    
    document.getElementById('quiz-empty-view').style.display = 'block';
    document.getElementById('quiz-main-view').style.display = 'none';
  }
}

export function setActiveNote(note) {
  activeNote = note;
  const titleField = document.getElementById('note-title-field');
  const bodyField = document.getElementById('note-editor-body');
  const statusField = document.getElementById('editor-save-status');

  // Close PDF viewer if it was open
  document.getElementById('pdf-viewer-container').classList.remove('active');
  activePdf = null;

  if (note) {
    titleField.disabled = false;
    titleField.value = note.title;
    bodyField.contentEditable = 'true';
    bodyField.innerHTML = note.content || '';
    statusField.textContent = 'Not düzenleniyor';
    
    // Highlight in list
    document.querySelectorAll('#notes-list-area .list-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === note.id);
    });
  } else {
    titleField.disabled = true;
    titleField.value = '';
    bodyField.contentEditable = 'false';
    bodyField.innerHTML = '';
    statusField.textContent = 'Not seçilmedi';
    
    document.querySelectorAll('#notes-list-area .list-item').forEach(item => {
      item.classList.remove('active');
    });
  }
}

export function setActivePdf(pdf) {
  activePdf = pdf;
  activeNote = null; // Unselect active note in editor
  setActiveNote(null);

  const container = document.getElementById('pdf-viewer-container');
  const titleField = document.getElementById('pdf-viewer-title-field');
  const contentBox = document.getElementById('pdf-text-content-box');

  if (pdf) {
    titleField.textContent = pdf.name;
    contentBox.textContent = pdf.textContent || 'Bu PDF dosyasından okunabilir metin çıkarılamadı.';
    container.classList.add('active');
    
    // Highlight in list
    document.querySelectorAll('#pdfs-list-area .list-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === pdf.id);
    });
  } else {
    container.classList.remove('active');
    document.querySelectorAll('#pdfs-list-area .list-item').forEach(item => {
      item.classList.remove('active');
    });
  }
}

/**
 * Display premium Toast Notifications
 */
export function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '30px';
    toastContainer.style.right = '30px';
    toastContainer.style.display = 'flex';
    toastContainer.style.flexDirection = 'column';
    toastContainer.style.gap = '10px';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.style.padding = '14px 20px';
  toast.style.borderRadius = '8px';
  toast.style.fontFamily = 'var(--font-body)';
  toast.style.fontSize = '13.5px';
  toast.style.fontWeight = '500';
  toast.style.color = '#fff';
  toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
  toast.style.transform = 'translateY(50px)';
  toast.style.opacity = '0';
  toast.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '10px';
  toast.style.minWidth = '250px';

  // Styling based on type
  if (type === 'success') {
    toast.style.backgroundColor = '#10b981';
    toast.innerHTML = `
      <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
      <span>${message}</span>
    `;
  } else if (type === 'error') {
    toast.style.backgroundColor = '#ef4444';
    toast.innerHTML = `
      <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg>
      <span>${message}</span>
    `;
  } else {
    toast.style.backgroundColor = '#f59e0b';
    toast.innerHTML = `
      <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z"/></svg>
      <span>${message}</span>
    `;
  }

  toastContainer.appendChild(toast);

  // Trigger entering animation
  setTimeout(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  }, 50);

  // Remove toast after duration
  setTimeout(() => {
    toast.style.transform = 'translateY(-20px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

/**
 * Update the Top Header API configuration badge status
 */
export function updateApiKeyBadgeStatus() {
  const badge = document.getElementById('api-key-setup-btn');
  const text = document.getElementById('api-key-status-text');
  
  if (getApiKey()) {
    badge.classList.add('configured');
    text.textContent = 'Gemini API Aktif';
  } else {
    badge.classList.remove('configured');
    text.textContent = 'Gemini API Anahtarı Gerekli';
  }
}

/**
 * Render the banner figures at the top of Dashboard
 */
export function renderDashboardStats(stats) {
  document.getElementById('stat-total-notes').textContent = stats.totalNotes;
  document.getElementById('stat-total-pdfs').textContent = stats.totalPdfs;
  document.getElementById('stat-avg-score').textContent = `${stats.avgScore}%`;
}

/**
 * Render Course Cards on grid matching selected year
 * 
 * @param {Array} courses List of all course objects
 * @param {number} year Selected year tab (1-4)
 * @param {Function} onCourseClick Callback when card is clicked
 */
export function renderCoursesGrid(courses, year, onCourseClick) {
  const grid = document.getElementById('courses-grid-area');
  grid.innerHTML = '';
  activeYearTab = parseInt(year);

  // Filter courses for the selected year
  const filtered = courses.filter(c => c.year === activeYearTab);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <h3>Ders Bulunamadı</h3>
        <p>Bu sınıfa ait henüz bir ders eklenmemiş.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(course => {
    const card = document.createElement('div');
    card.className = 'course-card';
    if (activeCourse && activeCourse.id === course.id) {
      card.style.borderColor = 'var(--accent-gold)';
    }

    card.innerHTML = `
      <div class="course-header">
        <div class="course-icon-box">
          <!-- Scale/Justice SVG Icon -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v17M3 12h18M5 7l3 3M19 7l-3 3M5 17l3-3M19 17l-3-3" />
          </svg>
        </div>
        <span class="course-year-badge">${course.year}. Sınıf</span>
      </div>
      
      <div class="course-info">
        <h4 class="course-title">${course.name}</h4>
        <p class="course-subtitle">Çukurova Hukuk Müfredatı</p>
      </div>
      
      <div class="course-stats">
        <div class="course-stat-item" title="Ders Notları">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/></svg>
          <span class="course-stat-val" id="card-note-count-${course.id}">-</span>
        </div>
        <div class="course-stat-item" title="PDF Dokümanları">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
          <span class="course-stat-val" id="card-pdf-count-${course.id}">-</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => onCourseClick(course));
    grid.appendChild(card);
  });
}

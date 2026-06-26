/* js/app.js */

import * as db from './db.js';
import { extractTextFromPdf } from './pdf-helper.js';
import * as ai from './gemini.js';
import * as ui from './ui.js';

// Turkish Universities and Departments list
const TURKISH_UNIVERSITIES = [
  "Çukurova Üniversitesi",
  "Orta Doğu Teknik Üniversitesi (ODTÜ)",
  "Ankara Üniversitesi",
  "İstanbul Üniversitesi",
  "İstanbul Teknik Üniversitesi (İTÜ)",
  "Hacettepe Üniversitesi",
  "Boğaziçi Üniversitesi",
  "Yıldız Teknik Üniversitesi (YTÜ)",
  "Marmara Üniversitesi",
  "Gazi Üniversitesi",
  "Ege Üniversitesi",
  "Dokuz Eylül Üniversitesi",
  "Bilkent Üniversitesi",
  "Koç Üniversitesi",
  "Sabancı Üniversitesi",
  "Bahçeşehir Üniversitesi",
  "Yeditepe Üniversitesi",
  "Özyeğin Üniversitesi",
  "TOBB ETÜ",
  "Kadir Has Üniversitesi",
  "MEF Üniversitesi",
  "Anadolu Üniversitesi",
  "Akdeniz Üniversitesi",
  "Karadeniz Teknik Üniversitesi (KTÜ)",
  "Bursa Uludağ Üniversitesi",
  "Selçuk Üniversitesi",
  "Erciyes Üniversitesi",
  "Kocaeli Üniversitesi",
  "Sakarya Üniversitesi",
  "Eskişehir Osmangazi Üniversitesi",
  "diğer"
];

const DEPARTMENTS = [
  "Hukuk",
  "Bilgisayar Mühendisliği",
  "Tıp",
  "İşletme",
  "Elektrik-Elektronik Mühendisliği",
  "Makine Mühendisliği",
  "Endüstri Mühendisliği",
  "Mimarlık",
  "Psikoloji",
  "Sosyoloji",
  "İktisat",
  "Uluslararası İlişkiler",
  "diğer"
];

// Application State
let courses = [];
let activeQuiz = null;
let currentQuestionIndex = 0;
let quizScore = 0;
let quizAnswers = [];
let chatHistory = [];
let debounceSaveTimer = null;
let currentUser = null;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Initialize IndexedDB
    await db.initDb();
    
    // 2. Seed community items
    await db.seedCommunityItems();
    
    // 3. Setup Auth forms and dynamic dropdown lists
    initAuthPage();
    
    // 4. Set up event listeners
    initEventListeners();
    
    // 5. Load User session
    const savedUser = localStorage.getItem('currentUser');
    if (!savedUser) {
      // Hide main app header and sidebar, redirect to auth-page
      document.querySelector('.sidebar').style.display = 'none';
      document.querySelector('.main-content').style.marginLeft = '0';
      document.getElementById('mobile-menu-toggle').style.display = 'none';
      switchPageProgrammatic('auth-page');
    } else {
      currentUser = JSON.parse(savedUser);
      // Profile complete: load dashboard
      document.querySelector('.sidebar').style.display = 'flex';
      document.getElementById('mobile-menu-toggle').style.display = 'flex';
      
      // Update sidebar/header info
      document.getElementById('sidebar-brand-sub').textContent = currentUser.department.toUpperCase();
      document.getElementById('current-course-display').textContent = `${currentUser.university} - ${currentUser.department.toUpperCase()}`;
      document.getElementById('dashboard-welcome-title').textContent = `Hoş geldin, ${currentUser.fullName}!`;
      
      // Set active AI API keys
      if (currentUser.apiKey) {
        ai.setApiKey(currentUser.apiKey);
        if (currentUser.apiModel) {
          ai.setApiModel(currentUser.apiModel);
        }
      }
      ui.updateApiKeyBadgeStatus();
      
      await refreshDashboard();
      switchPageProgrammatic('dashboard-page');
    }
    
    ui.showToast('Çalışma platformu başarıyla yüklendi.');
  } catch (error) {
    console.error('App init error:', error);
    ui.showToast('Sistem yüklenirken hata oluştu.', 'error');
  }
});

// Programmatic page switching helper
function switchPageProgrammatic(pageId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  // Show selected page
  const selectedPage = document.getElementById(pageId);
  if (selectedPage) {
    selectedPage.classList.add('active');
  }

  // Update sidebar active highlights if menu link exists
  document.querySelectorAll('.sidebar-menu .menu-item').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.page === pageId) {
      link.classList.add('active');
    }
  });

  // Trigger contextual page loading
  if (pageId === 'dashboard-page') {
    refreshDashboard();
  } else if (pageId === 'community-page') {
    loadCommunityPanel();
  }
}

// Event Listeners Registration
function initEventListeners() {
  // SPA Sidebar Routing
  document.querySelectorAll('.sidebar-menu .menu-item').forEach(link => {
    if (link.id !== 'menu-logout') {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = link.dataset.page;
        switchPageProgrammatic(pageId);
      });
    }
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

  // Settings Modal triggers
  document.getElementById('api-key-setup-btn').addEventListener('click', () => {
    const keyField = document.getElementById('api-key-input');
    keyField.value = ai.getApiKey();
    const modelSelect = document.getElementById('api-model-select');
    if (modelSelect) {
      modelSelect.value = ai.getApiModel();
    }
    
    // Populate profile inputs in settings modal
    const uSelect = document.getElementById('settings-univ-select');
    const dSelect = document.getElementById('settings-dept-select');
    
    if (uSelect) {
      uSelect.innerHTML = TURKISH_UNIVERSITIES.map(u => `<option value="${u}">${u}</option>`).join('');
      uSelect.value = currentUser.university;
      
      uSelect.addEventListener('change', () => {
        document.getElementById('settings-univ-custom').style.display = uSelect.value === 'diğer' ? 'block' : 'none';
      });
    }
    if (dSelect) {
      dSelect.innerHTML = DEPARTMENTS.map(d => `<option value="${d.toLowerCase().replace(/[^a-z0-9]/g, '-')}">${d}</option>`).join('');
      dSelect.value = currentUser.department;
      
      dSelect.addEventListener('change', () => {
        document.getElementById('settings-dept-custom').style.display = dSelect.value === 'diğer' ? 'block' : 'none';
      });
    }
    
    openModal('api-key-modal');
  });
  
  document.getElementById('close-api-key-modal').addEventListener('click', () => {
    closeModal('api-key-modal');
  });
  
  document.getElementById('save-api-key-btn').addEventListener('click', handleSaveSettings);
  
  // Settings resets & tests
  document.getElementById('test-api-key-btn').addEventListener('click', async () => {
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
      const listStr = models.slice(0, 5).map(m => m.name.replace('models/', '')).join(', ');
      resultDiv.innerHTML = `<span style="color:#10b981;font-weight:bold;">✓ Bağlantı Başarılı!</span>\nModeller: ${listStr}`;
    } catch (err) {
      resultDiv.innerHTML = `<span style="color:#ef4444;font-weight:bold;">✗ Bağlantı Başarısız!</span>\nHata: ${err.message}`;
    }
  });

  document.getElementById('clear-api-key-btn').addEventListener('click', () => {
    ai.setApiKey('');
    ui.updateApiKeyBadgeStatus();
    closeModal('api-key-modal');
    ui.showToast('API Anahtarı silindi.', 'warning');
  });

  document.getElementById('settings-reset-system-btn').addEventListener('click', () => {
    if (confirm('DİKKAT! Tüm veritabanını, notları ve kayıtları silerek kurulum ekranına dönmek istediğinizden emin misiniz? Bu işlem geri alınamaz!')) {
      localStorage.clear();
      indexedDB.deleteDatabase('cukurova_hukuk_db');
      location.reload();
    }
  });

  // Course detail back
  document.getElementById('course-detail-back-btn').addEventListener('click', () => {
    switchPageProgrammatic('dashboard-page');
  });

  document.getElementById('course-detail-delete-btn').addEventListener('click', async () => {
    if (ui.activeCourse && confirm(`“${ui.activeCourse.name}” dersini ve bu derse ait TÜM PDF/Not/Soru içeriklerini silmek istediğinizden emin misiniz?`)) {
      try {
        await db.deleteCourse(ui.activeCourse.id);
        ui.showToast('Ders ve ilişkili tüm içerikleri silindi.', 'warning');
        switchPageProgrammatic('dashboard-page');
      } catch (err) {
        ui.showToast('Ders silinirken hata oluştu.', 'error');
      }
    }
  });

  // Course detail additions
  document.getElementById('detail-create-note-btn').addEventListener('click', handleCreateNote);

  const dropzone = document.getElementById('detail-pdf-dropzone');
  const fileInput = document.getElementById('detail-pdf-file-input');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handlePdfFileSelect);
    
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === 'application/pdf') {
        processPdfUpload(files[0]);
      } else {
        ui.showToast('Lütfen geçerli bir PDF dosyası bırakın.', 'error');
      }
    });
  }

  // Notebook workspace triggers
  document.getElementById('notebook-back-btn').addEventListener('click', () => {
    if (ui.activeCourse) {
      loadCourseDetails(ui.activeCourse);
      switchPageProgrammatic('course-detail-page');
    } else {
      switchPageProgrammatic('dashboard-page');
    }
  });

  // Collapsible Left Assistant panel toggle
  const notebookToggleBtn = document.getElementById('notebook-toggle-sidebar-btn');
  if (notebookToggleBtn) {
    notebookToggleBtn.addEventListener('click', () => {
      const leftPanel = document.querySelector('.workspace-panel-left');
      if (leftPanel) {
        leftPanel.classList.toggle('collapsed');
        const isCollapsed = leftPanel.classList.contains('collapsed');
        if (isCollapsed) {
          notebookToggleBtn.innerHTML = '<span id="notebook-toggle-sidebar-icon">▶</span> Asistan Panelini Göster';
        } else {
          notebookToggleBtn.innerHTML = '<span id="notebook-toggle-sidebar-icon">◀</span> Asistan Panelini Gizle';
        }
      }
    });
  }

  // Collapsible Main Sidebar toggle
  const sidebarToggleBtn = document.getElementById('mobile-menu-toggle');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar');
      const mainContent = document.querySelector('.main-content');
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-active');
      } else {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('full-width');
      }
    });
  }

  // Desktop sidebar collapse button
  const desktopCollapseBtn = document.getElementById('sidebar-collapse-btn-desktop');
  if (desktopCollapseBtn) {
    desktopCollapseBtn.addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar');
      const mainContent = document.querySelector('.main-content');
      sidebar.classList.add('collapsed');
      mainContent.classList.add('full-width');
    });
  }

  // Close sidebar on menu click on mobile
  document.querySelectorAll('.sidebar-menu .menu-item').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('mobile-active');
      }
    });
  });

  // Logout trigger
  const logoutBtn = document.getElementById('menu-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  document.getElementById('notebook-share-btn').addEventListener('click', handleShareToCommunity);

  document.querySelectorAll('.workspace-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.workspace-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.workspace-tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      const tabContent = document.getElementById(tabId);
      if (tabContent) tabContent.classList.add('active');
    });
  });

  document.getElementById('chat-form-element').addEventListener('submit', handleChatSubmit);
  const chatInput = document.getElementById('chat-input-field');
  if (chatInput) {
    chatInput.addEventListener('input', () => {
      const submitBtn = document.getElementById('chat-submit-btn');
      if (submitBtn) submitBtn.disabled = !chatInput.value.trim();
    });
  }

  document.getElementById('start-ai-quiz-generation').addEventListener('click', handleAiQuizGeneration);
  document.getElementById('start-local-pdf-quiz').addEventListener('click', handleLocalPdfQuizConversion);
  document.getElementById('quiz-next-btn').addEventListener('click', handleQuizNext);
  document.getElementById('quiz-quit-btn').addEventListener('click', () => {
    if (confirm('Sınavı bitirmek istediğinizden emin misiniz?')) restartQuizSetup();
  });
  document.getElementById('results-restart-btn').addEventListener('click', restartQuiz);

  document.getElementById('workspace-note-save-btn').addEventListener('click', saveWorkspaceNote);

  // Editor rich text command buttons
  document.querySelectorAll('.editor-toolbar .toolbar-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      const val = btn.dataset.val || null;
      document.execCommand(cmd, false, val);
      document.getElementById('note-editor-body').focus();
      handleNoteContentChange();
    });
  });

  const noteTitleField = document.getElementById('note-title-field');
  const noteBodyField = document.getElementById('note-editor-body');
  if (noteTitleField) noteTitleField.addEventListener('input', handleNoteContentChange);
  if (noteBodyField) noteBodyField.addEventListener('input', handleNoteContentChange);
  
  const editorSaveBtn = document.getElementById('editor-save-btn');
  if (editorSaveBtn) editorSaveBtn.addEventListener('click', saveActiveNoteImmediate);

  // Community Filters
  const fUniv = document.getElementById('comm-filter-univ');
  const fDept = document.getElementById('comm-filter-dept');
  const fType = document.getElementById('comm-filter-type');
  if (fUniv) fUniv.addEventListener('change', filterCommunityItems);
  if (fDept) fDept.addEventListener('change', filterCommunityItems);
  if (fType) fType.addEventListener('change', filterCommunityItems);
}

// Modal open/close helpers
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

// --- AUTHENTICATION INTERACTIVE PAGE FUNCTIONS ---
function initAuthPage() {
  const univSelect = document.getElementById('register-univ-select');
  const deptSelect = document.getElementById('register-dept-select');
  
  if (univSelect) {
    univSelect.innerHTML = '<option value="">Üniversite Seçin...</option>' + 
      TURKISH_UNIVERSITIES.map(u => `<option value="${u}">${u}</option>`).join('');
      
    univSelect.addEventListener('change', () => {
      const customInput = document.getElementById('register-univ-custom');
      if (customInput) {
        customInput.style.display = univSelect.value === 'diğer' ? 'block' : 'none';
        if (univSelect.value === 'diğer') customInput.required = true;
        else customInput.required = false;
      }
    });
  }
  
  if (deptSelect) {
    deptSelect.innerHTML = '<option value="">Bölüm Seçin...</option>' + 
      DEPARTMENTS.map(d => `<option value="${d.toLowerCase().replace(/[^a-z0-9]/g, '-')}">${d}</option>`).join('');
      
    deptSelect.addEventListener('change', () => {
      const customInput = document.getElementById('register-dept-custom');
      if (customInput) {
        customInput.style.display = deptSelect.value === 'diğer' ? 'block' : 'none';
        if (deptSelect.value === 'diğer') customInput.required = true;
        else customInput.required = false;
      }
    });
  }
  
  // Navigation between Login and Register cards
  const toRegister = document.getElementById('go-to-register-link');
  const toLogin = document.getElementById('go-to-login-link');
  const loginCard = document.getElementById('auth-login-card');
  const registerCard = document.getElementById('auth-register-card');
  
  if (toRegister && loginCard && registerCard) {
    toRegister.addEventListener('click', (e) => {
      e.preventDefault();
      loginCard.style.display = 'none';
      registerCard.style.display = 'block';
    });
  }
  if (toLogin && loginCard && registerCard) {
    toLogin.addEventListener('click', (e) => {
      e.preventDefault();
      registerCard.style.display = 'none';
      loginCard.style.display = 'block';
    });
  }

  // Forms submission registration
  const loginForm = document.getElementById('auth-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginUser);
  }
  const registerForm = document.getElementById('auth-register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterUser);
  }
}

// User registration handler
async function handleRegisterUser(e) {
  e.preventDefault();
  
  const fullName = document.getElementById('register-fullname').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const univSelect = document.getElementById('register-univ-select');
  const deptSelect = document.getElementById('register-dept-select');
  const customUniv = document.getElementById('register-univ-custom').value.trim();
  const customDept = document.getElementById('register-dept-custom').value.trim();
  const apiKey = document.getElementById('register-api-key').value.trim();

  let university = univSelect.value === 'diğer' ? customUniv : univSelect.value;
  let department = deptSelect.value === 'diğer' ? customDept : deptSelect.value;

  if (!university || !department) {
    ui.showToast('Lütfen üniversite ve bölüm seçiniz.', 'error');
    return;
  }

  const user = {
    username,
    email,
    password,
    fullName,
    university,
    department,
    apiKey,
    createdAt: Date.now()
  };

  try {
    ui.showToast('Kayıt oluşturuluyor...');
    await db.registerUser(user);
    
    // Seed default curriculum courses for the new user
    ui.showToast('Müfredat dersleri hazırlanıyor...');
    await db.setupCurriculum(university, department, username);
    
    // Log user in automatically
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // UI changes to show dashboard
    document.querySelector('.sidebar').style.display = 'flex';
    document.getElementById('mobile-menu-toggle').style.display = 'flex';
    
    // Update sidebar/header info
    document.getElementById('sidebar-brand-sub').textContent = currentUser.department.toUpperCase();
    document.getElementById('current-course-display').textContent = `${currentUser.university} - ${currentUser.department.toUpperCase()}`;
    document.getElementById('dashboard-welcome-title').textContent = `Hoş geldin, ${currentUser.fullName}!`;
    
    if (currentUser.apiKey) {
      ai.setApiKey(currentUser.apiKey);
    }
    ui.updateApiKeyBadgeStatus();
    
    document.getElementById('auth-register-form').reset();
    
    await refreshDashboard();
    switchPageProgrammatic('dashboard-page');
    ui.showToast('Kayıt başarılı! Kampüs NotebookLM\'e hoş geldiniz.', 'success');
  } catch (err) {
    ui.showToast('Kayıt hatası: ' + err.message, 'error');
  }
}

// User login handler
async function handleLoginUser(e) {
  e.preventDefault();
  
  const usernameOrEmail = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    ui.showToast('Giriş yapılıyor...');
    const user = await db.loginUser(usernameOrEmail, password);
    
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // UI changes to show dashboard
    document.querySelector('.sidebar').style.display = 'flex';
    document.getElementById('mobile-menu-toggle').style.display = 'flex';
    
    // Update sidebar/header info
    document.getElementById('sidebar-brand-sub').textContent = currentUser.department.toUpperCase();
    document.getElementById('current-course-display').textContent = `${currentUser.university} - ${currentUser.department.toUpperCase()}`;
    document.getElementById('dashboard-welcome-title').textContent = `Hoş geldin, ${currentUser.fullName}!`;
    
    if (currentUser.apiKey) {
      ai.setApiKey(currentUser.apiKey);
      if (currentUser.apiModel) {
        ai.setApiModel(currentUser.apiModel);
      }
    }
    ui.updateApiKeyBadgeStatus();
    
    document.getElementById('auth-login-form').reset();
    
    await refreshDashboard();
    switchPageProgrammatic('dashboard-page');
    ui.showToast('Başarıyla giriş yapıldı.', 'success');
  } catch (err) {
    ui.showToast('Giriş başarısız: ' + err.message, 'error');
  }
}

// Logout handler
function handleLogout() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  ai.setApiKey('');
  ui.updateApiKeyBadgeStatus();
  
  // Hide UI layouts
  document.querySelector('.sidebar').style.display = 'none';
  document.querySelector('.main-content').style.marginLeft = '0';
  document.getElementById('mobile-menu-toggle').style.display = 'none';
  
  // Remove collapsible classes if active
  document.querySelector('.sidebar').classList.remove('collapsed', 'mobile-active');
  document.querySelector('.main-content').classList.remove('full-width');
  
  switchPageProgrammatic('auth-page');
  ui.showToast('Oturum kapatıldı.', 'warning');
}

// Refresh Dashboard Info
async function refreshDashboard() {
  if (!currentUser) return;
  courses = await db.getCourses(currentUser.username);
  const stats = await db.getGlobalStats();
  ui.renderDashboardStats(stats);
  
  const uni = currentUser.university || 'Kampüs';
  const dept = currentUser.department || 'NotebookLM';
  
  const welcomeTitle = document.getElementById('dashboard-welcome-title');
  if (welcomeTitle) welcomeTitle.textContent = `Hoş geldin, ${currentUser.fullName}!`;
  
  const welcomeDesc = document.getElementById('dashboard-welcome-desc');
  if (welcomeDesc) {
    const DEPT_LABELS_FULL = {
      'hukuk': 'Hukuk',
      'bilgisayar-muhendisligi': 'Bilgisayar Mühendisliği',
      'tip': 'Tıp Fakültesi',
      'isletme': 'İşletme',
      'diger': 'Genel Akademik'
    };
    const deptLabel = DEPT_LABELS_FULL[dept] || dept.toUpperCase();
    welcomeDesc.textContent = `Eğitim Profiliniz: ${uni} - ${deptLabel}. Derslerinize ait kaynakları yükleyerek başlayabilir, notlarınızı düzenleyebilir ve Gemini AI ile dilediğiniz ders veya PDF üzerinden sınavlar oluşturarak kendinizi test edebilirsiniz.`;
  }

  // Update brand header
  ui.setActiveCourse(null);
  
  renderCoursesGridByTab(ui.activeYearTab);
}

// Render grid based on year
async function renderCoursesGridByTab(year) {
  ui.renderCoursesGrid(courses, year, (course) => {
    loadCourseDetails(course);
    switchPageProgrammatic('course-detail-page');
  });
  
  // Refresh course cards note and pdf counts
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

// Add Course submit
async function handleAddCourse(e) {
  e.preventDefault();
  if (!currentUser) return;
  
  const name = document.getElementById('course-name-input').value;
  const year = parseInt(document.getElementById('course-year-input').value);
  
  const baseId = name.toLowerCase()
                     .replace(/[^a-z0-9]/g, '-')
                     .replace(/-+/g, '-')
                     .trim();
  
  // Generate unique course ID per user to prevent ID conflicts
  const id = `${baseId}-${currentUser.username}`;

  const newCourse = { id, name, year, userId: currentUser.username };

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

// --- SETTINGS SAVE ---
async function handleSaveSettings() {
  if (!currentUser) return;
  const key = document.getElementById('api-key-input').value.trim();
  const model = document.getElementById('api-model-select').value;
  
  if (key) {
    ai.setApiKey(key);
    ai.setApiModel(model);
    ui.updateApiKeyBadgeStatus();
  }

  const uSelect = document.getElementById('settings-univ-select');
  const dSelect = document.getElementById('settings-dept-select');
  const uCustom = document.getElementById('settings-univ-custom');
  const dCustom = document.getElementById('settings-dept-custom');

  let university = uSelect.value === 'diğer' ? uCustom.value.trim() : uSelect.value;
  let department = dSelect.value === 'diğer' ? dCustom.value.trim() : dSelect.value;

  if (!university) university = currentUser.university;
  if (!department) department = currentUser.department;

  const oldDept = currentUser.department;
  
  if (department !== oldDept) {
    if (!confirm('DİKKAT! Bölüm değiştirme işlemi bu bölüme ait ders programını müfredatınıza ekleyecektir. Devam etmek istiyor musunuz?')) {
      closeModal('api-key-modal');
      return;
    }
    
    try {
      await db.setupCurriculum(university, department, currentUser.username);
      ui.showToast('Yeni bölüm müfredatı derslerinize yüklendi.', 'warning');
    } catch (err) {
      ui.showToast('Müfredat güncellenemedi.', 'error');
    }
  }

  // Update currentUser object
  currentUser.university = university;
  currentUser.department = department;
  currentUser.apiKey = key;
  currentUser.apiModel = model;

  try {
    await db.updateUserProfile(currentUser);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Update brand titles
    document.getElementById('sidebar-brand-sub').textContent = currentUser.department.toUpperCase();
    document.getElementById('current-course-display').textContent = `${currentUser.university} - ${currentUser.department.toUpperCase()}`;
    document.getElementById('dashboard-welcome-title').textContent = `Hoş geldin, ${currentUser.fullName}!`;
    
    ui.showToast('Profil ve API ayarları başarıyla kaydedildi.');
  } catch (err) {
    console.error(err);
    ui.showToast('Profil kaydedilirken hata oluştu.', 'error');
  }

  closeModal('api-key-modal');
  await refreshDashboard();
}

// --- COURSE DETAILS LOADING ---
async function loadCourseDetails(course) {
  ui.setActiveCourse(course);
  
  const nameField = document.getElementById('detail-course-name');
  const metaField = document.getElementById('detail-course-meta');
  if (nameField) nameField.textContent = course.name;
  if (metaField) {
    const dept = currentUser ? currentUser.department : (localStorage.getItem('selected_department') || 'diger');
    metaField.textContent = `${course.year}. Sınıf • ${dept.toUpperCase().replace('-', ' ')}`;
  }

  await refreshCourseDetailLists();
}


async function refreshCourseDetailLists() {
  if (!ui.activeCourse) return;

  const pdfs = await db.getPdfs(ui.activeCourse.id);
  const notes = await db.getNotes(ui.activeCourse.id);
  const quizzes = await db.getQuizBanks(ui.activeCourse.id);

  // Render PDFs List
  const pdfList = document.getElementById('detail-pdfs-list');
  pdfList.innerHTML = '';
  if (pdfs.length === 0) {
    pdfList.innerHTML = '<li class="text-muted" style="font-size:12px; padding:10px 0; text-align:center;">Belge bulunmuyor.</li>';
  } else {
    pdfs.forEach(pdf => {
      const li = document.createElement('li');
      li.className = 'detail-item-card';
      li.innerHTML = `
        <div class="detail-item-info">
          <span class="detail-item-name">${pdf.name}</span>
          <span class="detail-item-meta">${Math.round(pdf.size / 1024)} KB</span>
        </div>
        <div class="detail-item-actions">
          <button class="action-icon-btn btn-delete" data-action="delete" title="Belgeyi Sil">
            <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m9.03-9.25 1.07 10.53a1.88 1.88 0 0 1-1.87 2.07H5.06a1.88 1.88 0 0 1-1.87-2.07L4.25 4.75h15.5Z"/></svg>
          </button>
        </div>
      `;
      li.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete')) {
          e.stopPropagation();
          handleDeletePdf(pdf.id, pdf.name);
        } else {
          openSourceInWorkspace('pdf', pdf);
        }
      });
      pdfList.appendChild(li);
    });
  }

  // Render Notes List
  const notesList = document.getElementById('detail-notes-list');
  notesList.innerHTML = '';
  if (notes.length === 0) {
    notesList.innerHTML = '<li class="text-muted" style="font-size:12px; padding:10px 0; text-align:center;">Not bulunmuyor.</li>';
  } else {
    notes.forEach(note => {
      const li = document.createElement('li');
      li.className = 'detail-item-card';
      li.innerHTML = `
        <div class="detail-item-info">
          <span class="detail-item-name">${note.title}</span>
          <span class="detail-item-meta">Ders Notu</span>
        </div>
        <div class="detail-item-actions">
          <button class="action-icon-btn btn-delete" data-action="delete" title="Notu Sil">
            <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m9.03-9.25 1.07 10.53a1.88 1.88 0 0 1-1.87 2.07H5.06a1.88 1.88 0 0 1-1.87-2.07L4.25 4.75h15.5Z"/></svg>
          </button>
        </div>
      `;
      li.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete')) {
          e.stopPropagation();
          handleDeleteNote(note.id, note.title);
        } else {
          openSourceInWorkspace('note', note);
        }
      });
      notesList.appendChild(li);
    });
  }

  // Render Quiz Banks
  const quizzesList = document.getElementById('detail-quizzes-list');
  quizzesList.innerHTML = '';
  if (quizzes.length === 0) {
    quizzesList.innerHTML = '<li class="text-muted" style="font-size:12px; padding:10px 0; text-align:center;">Soru bankası bulunmuyor.</li>';
  } else {
    quizzes.forEach(bank => {
      const li = document.createElement('li');
      li.className = 'detail-item-card';
      li.innerHTML = `
        <div class="detail-item-info">
          <span class="detail-item-name">${bank.name}</span>
          <span class="detail-item-meta">${bank.questions.length} Soru</span>
        </div>
        <div class="detail-item-actions">
          <button class="action-icon-btn btn-delete" data-action="delete" title="Soru Bankasını Sil">
            <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m9.03-9.25 1.07 10.53a1.88 1.88 0 0 1-1.87 2.07H5.06a1.88 1.88 0 0 1-1.87-2.07L4.25 4.75h15.5Z"/></svg>
          </button>
        </div>
      `;
      li.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete')) {
          e.stopPropagation();
          handleDeleteQuizBank(bank.id, bank.name);
        } else {
          openSourceInWorkspace('quiz', bank);
        }
      });
      quizzesList.appendChild(li);
    });
  }
}

// PDF file uploads
function handlePdfFileSelect(e) {
  const file = e.target.files[0];
  if (file && file.type === 'application/pdf') {
    processPdfUpload(file);
  } else {
    ui.showToast('Lütfen geçerli bir PDF belgesi yükleyin.', 'error');
  }
}

async function processPdfUpload(file) {
  ui.showToast('PDF yükleme başladı, metin ayıklanıyor...');
  const reader = new FileReader();
  reader.onload = async function() {
    const arrayBuffer = this.result;
    try {
      const extractedText = await extractTextFromPdf(arrayBuffer, (page, total) => {
        // console.log(`PDF read progress: page ${page} of ${total}`);
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
      ui.showToast(`${file.name} başarıyla yüklendi.`);
      await refreshCourseDetailLists();
    } catch (error) {
      console.error(error);
      ui.showToast('PDF okunurken bir hata oluştu: ' + error.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// Delete Helpers
async function handleDeletePdf(id, name) {
  if (confirm(`"${name}" dökümanını silmek istiyor musunuz?`)) {
    try {
      await db.deletePdf(id);
      ui.showToast('Belge silindi.', 'warning');
      await refreshCourseDetailLists();
    } catch (e) {
      ui.showToast('Belge silinemedi.', 'error');
    }
  }
}

async function handleDeleteNote(id, title) {
  if (confirm(`"${title}" notunu silmek istiyor musunuz?`)) {
    try {
      await db.deleteNote(id);
      ui.showToast('Ders notu silindi.', 'warning');
      await refreshCourseDetailLists();
    } catch (e) {
      ui.showToast('Not silinemedi.', 'error');
    }
  }
}

async function handleDeleteQuizBank(id, name) {
  if (confirm(`"${name}" soru bankasını silmek istiyor musunuz?`)) {
    try {
      await db.deleteQuizBank(id);
      ui.showToast('Soru bankası silindi.', 'warning');
      await refreshCourseDetailLists();
    } catch (e) {
      ui.showToast('Soru bankası silinemedi.', 'error');
    }
  }
}

// --- WORKSPACE LOADING & TABS ---
function openSourceInWorkspace(type, source) {
  switchPageProgrammatic('notebook-page');
  
  // Show/Hide Right Panel elements
  const pdfReader = document.getElementById('workspace-pdf-reader');
  const noteEditor = document.getElementById('workspace-note-editor');
  const typeBadge = document.getElementById('notebook-doc-type');

  // Activate Tab 1 (Chat) by default
  document.querySelector('.workspace-tab-btn[data-tab="tab-chat"]').click();

  if (type === 'pdf') {
    ui.setActivePdf(source);
    pdfReader.style.display = 'flex';
    noteEditor.style.display = 'none';
    typeBadge.textContent = 'PDF DÖKÜMANI';
    typeBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
    typeBadge.style.color = '#ef4444';
    
    // Configure Soru Çöz Setup panel in left panel
    document.getElementById('workspace-quiz-setup').style.display = 'block';
    document.getElementById('workspace-quiz-solving').style.display = 'none';
    document.getElementById('workspace-quiz-results').style.display = 'none';
  } else if (type === 'note') {
    ui.setActiveNote(source);
    pdfReader.style.display = 'none';
    noteEditor.style.display = 'flex';
    typeBadge.textContent = 'DERS NOTU';
    typeBadge.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
    typeBadge.style.color = '#3b82f6';
    
    document.getElementById('workspace-quiz-setup').style.display = 'block';
    document.getElementById('workspace-quiz-solving').style.display = 'none';
    document.getElementById('workspace-quiz-results').style.display = 'none';
  } else if (type === 'quiz') {
    // A saved quiz bank was opened directly! Load Soru Çöz tab directly
    ui.setActivePdf({
      name: source.name,
      textContent: `Soru Bankası: ${source.name}\n${source.questions.length} soru içeriyor.`
    });
    pdfReader.style.display = 'flex';
    noteEditor.style.display = 'none';
    typeBadge.textContent = 'TEST BANKASI';
    typeBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
    typeBadge.style.color = '#10b981';
    
    document.querySelector('.workspace-tab-btn[data-tab="tab-quiz"]').click();
    startQuizSession(source.questions);
  }

  // Clear workspace summary notepad
  const noteTitle = document.getElementById('workspace-note-title');
  const noteBody = document.getElementById('workspace-note-body');
  if (noteTitle) noteTitle.value = `Not: ${source.name || source.title}`;
  if (noteBody) noteBody.innerHTML = '';

  // Reset AI Sohbet messages for new context
  chatHistory = [];
  const chatMessages = document.getElementById('chat-messages-box');
  if (chatMessages) {
    chatMessages.innerHTML = `
      <div class="message ai">
        <div class="message-avatar">AI</div>
        <div class="message-content">
          <div class="message-bubble">
            <p>Merhaba! <strong>"${source.name || source.title}"</strong> kaynağınız yüklendi. Döküman ile ilgili benden özet veya açıklama isteyebilirsiniz.</p>
          </div>
        </div>
      </div>
    `;
  }
}

// Create a new note from details page
async function handleCreateNote() {
  const noteId = `note-${Date.now()}`;
  const newNote = {
    id: noteId,
    courseId: ui.activeCourse.id,
    title: 'Yeni Ders Notu',
    content: 'Bu alana ders notlarınızı yazın...',
    updatedAt: Date.now()
  };
  try {
    await db.saveNote(newNote);
    await refreshCourseDetailLists();
    openSourceInWorkspace('note', newNote);
  } catch (error) {
    ui.showToast('Not oluşturulamadı.', 'error');
  }
}

// Note Save triggers in main workspace
function handleNoteContentChange() {
  if (!ui.activeNote) return;
  document.getElementById('editor-save-status').textContent = 'Kaydediliyor...';
  clearTimeout(debounceSaveTimer);
  debounceSaveTimer = setTimeout(() => {
    saveActiveNoteImmediate();
  }, 1500);
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
    document.getElementById('editor-save-status').textContent = 'Kaydedildi';
  } catch (error) {
    document.getElementById('editor-save-status').textContent = 'Hata!';
  }
}

// Save summary notepad from Left Workspace Panel Tab 3
async function saveWorkspaceNote() {
  const title = document.getElementById('workspace-note-title').value.trim() || 'Çalışma Notu';
  const content = document.getElementById('workspace-note-body').innerHTML;
  if (!content.trim() || content === 'Notlarınızı buraya yazın...') {
    ui.showToast('Lütfen önce boş bırakılmaması için not yazın.', 'warning');
    return;
  }
  const noteId = `note-${Date.now()}`;
  const newNote = {
    id: noteId,
    courseId: ui.activeCourse.id,
    title,
    content,
    updatedAt: Date.now()
  };
  try {
    await db.saveNote(newNote);
    ui.showToast(`"${title}" başarıyla ders notlarınıza kaydedildi! ✍️`, 'success');
    document.getElementById('workspace-note-body').innerHTML = '';
  } catch (err) {
    ui.showToast('Çalışma notu kaydedilemedi.', 'error');
  }
}

// --- WORKSPACE NOTEBOOKLM AI CHAT ---
async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input-field');
  const query = input.value.trim();
  if (!query) return;

  input.value = '';
  document.getElementById('chat-submit-btn').disabled = true;

  if (!ai.hasApiKey()) {
    ui.showToast('Lütfen önce Gemini API Anahtarınızı profil ayarlarından girin.', 'warning');
    return;
  }

  // Get active source text
  let sourceText = '';
  if (ui.activePdf) {
    sourceText = ui.activePdf.textContent;
  } else if (ui.activeNote) {
    sourceText = ui.activeNote.content.replace(/<[^>]*>/g, ' ');
  }

  if (!sourceText.trim()) {
    ui.showToast('Çalışma kaynağında okunabilir bir metin içeriği bulunamadı.', 'error');
    return;
  }

  appendChatMessage('user', query);
  chatHistory.push({ role: 'user', text: query });

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
    const response = await ai.chatWithSources(chatHistory, sourceText);
    typingDiv.remove();
    appendChatMessage('ai', response);
    chatHistory.push({ role: 'ai', text: response });
  } catch (err) {
    typingDiv.remove();
    appendChatMessage('ai', `Hata: ${err.message}`);
    ui.showToast('Yapay zekadan cevap alınamadı.', 'error');
  }
}

function appendChatMessage(sender, text) {
  const chatBox = document.getElementById('chat-messages-box');
  if (!chatBox) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;
  
  let formattedText = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

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

// --- WORKSPACE AI & LOCAL QUIZ MODULE ---
async function handleAiQuizGeneration() {
  if (!ai.hasApiKey()) {
    ui.showToast('Lütfen önce Gemini API Anahtarınızı girin.', 'warning');
    return;
  }

  let sourceText = '';
  let sourceName = '';
  if (ui.activePdf) {
    sourceText = ui.activePdf.textContent;
    sourceName = ui.activePdf.name;
  } else if (ui.activeNote) {
    sourceText = ui.activeNote.content.replace(/<[^>]*>/g, ' ');
    sourceName = ui.activeNote.title;
  }

  if (!sourceText.trim()) {
    ui.showToast('Soru üretilecek kaynak içeriği boş.', 'error');
    return;
  }

  const startBtn = document.getElementById('start-ai-quiz-generation');
  const origText = startBtn.textContent;
  startBtn.textContent = 'Sorular Hazırlanıyor...';
  startBtn.disabled = true;

  const count = parseInt(document.getElementById('quiz-question-count').value);

  try {
    const questions = await ai.generateQuizFromSources(sourceText, count);
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Soru dizisi oluşturulamadı.');
    }
    await promptSaveQuizBank(questions, `${sourceName.replace(/\.[^/.]+$/, "")} - AI Sınavı`);
    startQuizSession(questions);
  } catch (err) {
    ui.showToast('Hata: ' + err.message, 'error');
  } finally {
    startBtn.textContent = origText;
    startBtn.disabled = false;
  }
}

async function handleLocalPdfQuizConversion() {
  let sourceText = '';
  let sourceName = '';
  if (ui.activePdf) {
    sourceText = ui.activePdf.textContent;
    sourceName = ui.activePdf.name;
  } else if (ui.activeNote) {
    sourceText = ui.activeNote.content.replace(/<[^>]*>/g, ' ');
    sourceName = ui.activeNote.title;
  }

  if (!sourceText.trim()) {
    ui.showToast('Kaynak döküman metni bulunamadı.', 'error');
    return;
  }

  const questions = parseLocalQuestions(sourceText);
  if (questions.length === 0) {
    ui.showToast('Bu dökümanda şablonumuza uyan soru kalıbı bulunamadı. AI ile dönüştürmeyi deneyin.', 'warning');
    return;
  }

  await promptSaveQuizBank(questions, `${sourceName.replace(/\.[^/.]+$/, "")} (Hızlı Sınav)`);
  startQuizSession(questions);
  ui.showToast(`⚡ ${questions.length} soru anında çıkarıldı ve sınav başladı!`);
}

function parseLocalQuestions(text) {
  const answerKey = {};
  const tail = text.slice(-3500);
  const keyTableRe = /(\d+)\s*[-\.\)\s]\s*([A-Ea-e])\b/g;
  let keyMatch;
  while ((keyMatch = keyTableRe.exec(tail)) !== null) {
    answerKey[parseInt(keyMatch[1])] = keyMatch[2].toUpperCase();
  }

  const blockSplitRe = /(?:^|\n)\s*(?:SORU\s*)?(\d{1,3})\s*[.\-\):](?!\d)/gi;
  const blocks = [];
  let lastIndex = 0;
  let lastNum = null;
  const matchList = [...text.matchAll(blockSplitRe)];

  for (let i = 0; i < matchList.length; i++) {
    const m = matchList[i];
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

  const questions = [];

  for (const block of blocks) {
    let blockText = block.text;
    
    // Split inline options on the same line (e.g. A) X B) Y) into newline-separated
    blockText = blockText.replace(/\s+([B-Eb-e])([\]\)\.-])\s*/gi, '\n$1$2 ');
    
    const lines = blockText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 3) continue;

    let questionLines = [];
    let options = [];
    let answerIndex = -1;
    let explanation = '';

    for (const line of lines) {
      const optMatch = line.match(/^[\[\(]?([A-Ea-e])[\]\).\-\s]\s*(.+)/);
      if (optMatch && options.length < 5) {
        options.push(optMatch[2].trim());
        continue;
      }
      const ansMatch = line.match(/^(?:cevap|yan[ıi]t|do[gğ]ru\s*(?:cevap)?)\s*[:\-]\s*([A-Ea-e])/i);
      if (ansMatch) {
        answerIndex = 'ABCDE'.indexOf(ansMatch[1].toUpperCase());
        continue;
      }
      const expMatch = line.match(/^(?:a[cç][ıi]klama|gerek[çc]e)\s*[:\-]\s*(.+)/i);
      if (expMatch) {
        explanation = expMatch[1];
        continue;
      }
      if (options.length === 0) questionLines.push(line);
    }

    const questionText = questionLines.join(' ').trim();
    if (!questionText || options.length < 2) continue;

    if (answerIndex === -1 && answerKey[block.num]) {
      answerIndex = 'ABCDE'.indexOf(answerKey[block.num]);
    }
    const finalIdx = answerIndex >= 0 ? answerIndex : 0;

    questions.push({
      question: `${block.num}. ${questionText}`,
      options: options.slice(0, 5),
      answerIndex: finalIdx,
      explanation: explanation ||
        (answerIndex >= 0
          ? `Doğru cevap: ${['A','B','C','D','E'][finalIdx]} şıkkıdır.`
          : 'Cevap anahtarı bu PDF\u2019te belirtilmemiş. AI dönüştürücü kullanarak detaylı açıklama alabilirsiniz.')
    });
  }

  return questions;
}

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

  // Show Active Solve layout
  document.getElementById('workspace-quiz-setup').style.display = 'none';
  document.getElementById('workspace-quiz-solving').style.display = 'flex';
  document.getElementById('workspace-quiz-results').style.display = 'none';

  renderQuizQuestion(0);
}

function renderQuizQuestion(index) {
  const q = activeQuiz.questions[index];
  
  document.getElementById('current-q-index').textContent = index + 1;
  document.getElementById('total-q-count').textContent = activeQuiz.questions.length;
  
  const pct = (index / activeQuiz.questions.length) * 100;
  document.getElementById('quiz-progress-bar').style.width = `${pct}%`;
  document.getElementById('quiz-score-badge').textContent = `Skor: ${quizScore} / ${activeQuiz.questions.length}`;

  document.getElementById('active-q-text').innerHTML = q.question.replace(/\n/g, '<br>');
  
  const optionsArea = document.getElementById('active-q-options');
  optionsArea.innerHTML = '';
  
  const prefixes = ['A', 'B', 'C', 'D', 'E'];
  q.options.forEach((optText, optIdx) => {
    const li = document.createElement('li');
    li.className = 'option-item';
    li.style.backgroundColor = 'rgba(255,255,255,0.02)';
    li.style.border = '1px solid var(--border-color)';
    li.style.padding = '10px 14px';
    li.style.borderRadius = '6px';
    li.style.cursor = 'pointer';
    li.style.display = 'flex';
    li.style.gap = '10px';
    li.style.transition = 'background-color 0.2s';
    
    li.innerHTML = `
      <span class="option-prefix" style="color:var(--accent-gold); font-weight:bold;">${prefixes[optIdx]}</span>
      <span class="option-text">${optText}</span>
    `;

    li.addEventListener('click', () => handleOptionClick(optIdx));
    optionsArea.appendChild(li);
  });

  document.getElementById('active-q-explanation-box').style.display = 'none';
  const nextBtn = document.getElementById('quiz-next-btn');
  nextBtn.disabled = true;
  nextBtn.textContent = index === activeQuiz.questions.length - 1 ? 'Sınavı Bitir' : 'Sonraki Soru';
}

function handleOptionClick(selectedIdx) {
  if (quizAnswers[currentQuestionIndex] !== null) return;
  const q = activeQuiz.questions[currentQuestionIndex];
  quizAnswers[currentQuestionIndex] = selectedIdx;

  const optionElements = document.querySelectorAll('#active-q-options .option-item');
  const isCorrect = (selectedIdx === q.answerIndex);

  optionElements.forEach((el, idx) => {
    if (idx === q.answerIndex) {
      el.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
      el.style.borderColor = '#10b981';
    } else if (idx === selectedIdx && !isCorrect) {
      el.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      el.style.borderColor = '#ef4444';
    }
  });

  if (isCorrect) {
    quizScore++;
    ui.showToast('Doğru cevap!', 'success');
  } else {
    ui.showToast('Yanlış cevap.', 'error');
  }

  const expBox = document.getElementById('active-q-explanation-box');
  const expText = document.getElementById('active-q-explanation-text');
  if (expBox && expText) {
    expText.innerHTML = q.explanation.replace(/\n/g, '<br>');
    expBox.style.display = 'flex';
  }

  document.getElementById('quiz-score-badge').textContent = `Skor: ${quizScore} / ${activeQuiz.questions.length}`;
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
    await db.saveQuiz(activeQuiz);
    
    document.getElementById('workspace-quiz-solving').style.display = 'none';
    document.getElementById('workspace-quiz-results').style.display = 'flex';

    document.getElementById('results-correct-count').textContent = quizScore;
    document.getElementById('results-wrong-count').textContent = activeQuiz.questions.length - quizScore;
    
    const pct = Math.round((quizScore / activeQuiz.questions.length) * 100);
    document.getElementById('results-percentage').textContent = `${pct}%`;

    const msgField = document.getElementById('results-message');
    if (pct >= 70) {
      msgField.textContent = 'Harika bir başarı! Konuyu çok iyi pekiştirmişsiniz. Tebrikler 🎓';
    } else if (pct >= 40) {
      msgField.textContent = 'İyi bir deneme! Yanlış yaptığınız gerekçeleri not alarak biraz daha çalışmak yararlı olabilir 📖';
    } else {
      msgField.textContent = 'Bu konu için notları biraz daha detaylı okuyup tekrar soru çözmeyi deneyelim. Çalışmaya devam! 💪';
    }
    
    // Refresh stats
    const stats = await db.getGlobalStats();
    ui.renderDashboardStats(stats);
  } catch (error) {
    ui.showToast('Skor veritabanına yazılamadı.', 'error');
  }
}

function restartQuiz() {
  if (activeQuiz && activeQuiz.questions) {
    startQuizSession(activeQuiz.questions);
  }
}

// Soru Bankasını Kaydet Modal Prompter
async function promptSaveQuizBank(questions, defaultName) {
  return new Promise((resolve) => {
    const modal = document.getElementById('save-bank-modal');
    const nameInput = document.getElementById('save-bank-name-input');
    const saveBtn = document.getElementById('save-bank-confirm-btn');
    const skipBtn = document.getElementById('save-bank-skip-btn');
    const countSpan = document.getElementById('save-bank-count');

    if (nameInput) nameInput.value = defaultName || '';
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

// --- WORKSPACE SOURCE SHARING TO COMMUNITY ---
async function handleShareToCommunity() {
  let itemToShare = null;
  const uni = localStorage.getItem('selected_university') || 'Genel Üniversite';
  const dept = localStorage.getItem('selected_department') || 'diger';

  if (ui.activePdf) {
    itemToShare = {
      id: `comm-${Date.now()}`,
      title: ui.activePdf.name,
      type: 'pdf',
      university: uni,
      department: dept,
      courseName: ui.activeCourse.name,
      size: ui.activePdf.size || 10240,
      textContent: ui.activePdf.textContent,
      uploaderName: 'Öğrenci',
      downloads: 0,
      createdAt: Date.now()
    };
  } else if (ui.activeNote) {
    itemToShare = {
      id: `comm-${Date.now()}`,
      title: ui.activeNote.title,
      type: 'note',
      university: uni,
      department: dept,
      courseName: ui.activeCourse.name,
      size: ui.activeNote.content.length,
      textContent: ui.activeNote.content,
      uploaderName: 'Öğrenci',
      downloads: 0,
      createdAt: Date.now()
    };
  }

  if (!itemToShare) {
    ui.showToast('Paylaşılacak aktif döküman bulunamadı.', 'warning');
    return;
  }

  if (confirm(`"${itemToShare.title}" dökümanını ${uni} - ${dept.toUpperCase()} topluluk kitaplığında paylaşmak istiyor musunuz?`)) {
    try {
      await db.addCommunityItem(itemToShare);
      ui.showToast('Döküman topluluk kütüphanesinde başarıyla paylaşıldı! 🌍', 'success');
    } catch (err) {
      ui.showToast('Paylaşılırken hata oluştu.', 'error');
    }
  }
}

// --- COMMUNITY PANEL ---
async function loadCommunityPanel() {
  const univFilter = document.getElementById('comm-filter-univ');
  if (!univFilter) return;

  try {
    const items = await db.getCommunityItems();
    
    // Populate University Dropdown uniquely
    const univs = [...new Set(items.map(item => item.university))];
    const curVal = univFilter.value;
    univFilter.innerHTML = '<option value="">Tüm Üniversiteler</option>';
    univs.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      univFilter.appendChild(opt);
    });
    univFilter.value = curVal;

    filterCommunityItems();
  } catch (err) {
    console.error(err);
  }
}

async function filterCommunityItems() {
  const grid = document.getElementById('community-grid-area');
  if (!grid) return;

  const fUniv = document.getElementById('comm-filter-univ').value.toLowerCase();
  const fDept = document.getElementById('comm-filter-dept').value.toLowerCase();
  const fType = document.getElementById('comm-filter-type').value.toLowerCase();

  try {
    const items = await db.getCommunityItems();
    grid.innerHTML = '';

    const filtered = items.filter(item => {
      const matchUniv = !fUniv || item.university.toLowerCase() === fUniv;
      const matchDept = !fDept || item.department.toLowerCase() === fDept;
      const matchType = !fType || item.type.toLowerCase() === fType;
      return matchUniv && matchDept && matchType;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding:60px 20px;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:48px;height:48px;color:var(--text-muted);margin-bottom:15px;"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" /></svg>
          <h3>Sonuç Bulunamadı</h3>
          <p>Seçtiğiniz filtrelere uyan hiçbir topluluk materyali bulunamadı.</p>
        </div>
      `;
      return;
    }

    filtered.sort((a,b) => b.createdAt - a.createdAt).forEach(item => {
      const card = document.createElement('div');
      card.className = 'community-card';
      const dateStr = new Date(item.createdAt).toLocaleDateString('tr-TR');
      
      const sizeLabel = item.type === 'pdf' ? `${Math.round(item.size/1024)} KB` : (item.type === 'note' ? 'Ders Notu' : 'Soru Bankası');

      card.innerHTML = `
        <div>
          <div class="comm-card-header">
            <span class="comm-type-badge ${item.type}">${item.type}</span>
            <span style="font-size:11px; color:var(--color-text-muted);">${dateStr}</span>
          </div>
          <h4 class="comm-card-title">${item.title}</h4>
          <div class="comm-card-tags">
            <span class="comm-tag">${item.university}</span>
            <span class="comm-tag">${item.courseName}</span>
            <span class="comm-tag">${sizeLabel}</span>
          </div>
        </div>
        <div>
          <div class="comm-card-footer">
            <span>Paylaşan: <strong class="comm-uploader">${item.uploaderName}</strong></span>
            <span>⬇ ${item.downloads} indirme</span>
          </div>
          <button class="btn btn-secondary btn-sm comm-import-btn" style="width:100%; margin-top:10px; font-size:12px; padding:6px 12px;">⬇ Derslerime Ekle (İndir)</button>
        </div>
      `;

      card.querySelector('.comm-import-btn').addEventListener('click', () => handleImportItemModal(item));
      grid.appendChild(card);
    });
  } catch (err) {
    ui.showToast('Topluluk materyalleri yüklenemedi.', 'error');
  }
}

// Modal for importing a community item to a user course
async function handleImportItemModal(item) {
  const currentCourses = await db.getCourses();
  if (currentCourses.length === 0) {
    ui.showToast('Bu materyali ekleyebilmeniz için önce Dashboard üzerinde en az 1 dersiniz olması gerekir.', 'warning');
    return;
  }

  // Create an overlay modal dynamically
  const modalDiv = document.createElement('div');
  modalDiv.className = 'modal active';
  modalDiv.id = 'import-community-modal';
  
  const selectOptions = currentCourses.map(c => `<option value="${c.id}">${c.name} (${c.year}. Sınıf)</option>`).join('');

  modalDiv.innerHTML = `
    <div class="modal-content" style="max-width:440px;">
      <div class="modal-header">
        <h3>⬇ Materyali İçe Aktar</h3>
      </div>
      <div class="modal-body" style="text-align:left;">
        <p style="font-size:13px; color:var(--color-text-muted); margin-bottom:15px; line-height:1.5;">
          <strong>"${item.title}"</strong> dökümanını hangi dersinize eklemek istersiniz?
        </p>
        <div class="form-group">
          <label for="import-course-select">Ders Seçin</label>
          <select class="input-field" id="import-course-select" style="width:100%; margin-top:5px;">
            ${selectOptions}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="import-cancel-btn">İptal</button>
        <button class="btn btn-primary" id="import-confirm-btn">Dersime Ekle</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalDiv);

  const cleanup = () => {
    modalDiv.remove();
  };

  modalDiv.querySelector('#import-cancel-btn').addEventListener('click', cleanup);
  
  modalDiv.querySelector('#import-confirm-btn').addEventListener('click', async () => {
    const courseId = modalDiv.querySelector('#import-course-select').value;
    const selectedCourse = currentCourses.find(c => c.id === courseId);
    
    try {
      if (item.type === 'pdf') {
        const newPdf = {
          id: `pdf-${Date.now()}`,
          courseId,
          name: item.title,
          size: item.size,
          textContent: item.textContent,
          uploadedAt: Date.now()
        };
        await db.savePdf(newPdf);
      } else if (item.type === 'note') {
        const newNote = {
          id: `note-${Date.now()}`,
          courseId,
          title: item.title,
          content: item.textContent,
          updatedAt: Date.now()
        };
        await db.saveNote(newNote);
      } else if (item.type === 'quiz') {
        const newBank = {
          id: `bank-${Date.now()}`,
          courseId,
          name: item.title,
          questions: JSON.parse(item.textContent),
          createdAt: Date.now()
        };
        await db.saveQuizBank(newBank);
      }

      // Update download count inside IndexedDB community store (simulate upload)
      item.downloads = (item.downloads || 0) + 1;
      await db.addCommunityItem(item);

      ui.showToast(`"${item.title}" belgesi "${selectedCourse.name}" dersine başarıyla eklendi!`, 'success');
    } catch (e) {
      console.error(e);
      ui.showToast('İçe aktarılırken hata oluştu.', 'error');
    }
    
    cleanup();
    filterCommunityItems();
  });
}

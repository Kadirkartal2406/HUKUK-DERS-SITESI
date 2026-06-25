/* js/db.js */

const DB_NAME = 'cukurova_hukuk_db';
const DB_VERSION = 1;

let dbInstance = null;

const DEFAULT_COURSES = [
  // 1. Sınıf
  { id: 'hukuk-baslangici', name: 'Hukuk Başlangıcı', year: 1 },
  { id: 'anayasa-hukuku-1', name: 'Anayasa Hukuku (Genel Esaslar)', year: 1 },
  { id: 'medeni-hukuk-1', name: 'Medeni Hukuk (Giriş - Kişiler - Aile)', year: 1 },
  { id: 'roma-hukuku', name: 'Roma Hukuku', year: 1 },
  { id: 'hukuk-tarihi', name: 'Hukuk Tarihi', year: 1 },
  { id: 'hukuk-sosyolojisi', name: 'Hukuk Sosyolojisi', year: 1 },
  
  // 2. Sınıf
  { id: 'borclar-genel', name: 'Borçlar Hukuku Genel Hükümler', year: 2 },
  { id: 'ceza-genel', name: 'Ceza Hukuku Genel Hükümler', year: 2 },
  { id: 'idare-hukuku', name: 'İdare Hukuku', year: 2 },
  { id: 'uluslararasi-kamu', name: 'Uluslararası Kamu Hukuku', year: 2 },
  { id: 'genel-kamu-teorisi', name: 'Genel Kamu Teorisi', year: 2 },
  
  // 3. Sınıf
  { id: 'borclar-ozel', name: 'Borçlar Hukuku Özel Hükümler', year: 3 },
  { id: 'ceza-ozel', name: 'Ceza Hukuku Özel Hükümler', year: 3 },
  { id: 'medeni-usul', name: 'Medeni Usul Hukuku', year: 3 },
  { id: 'esya-hukuku', name: 'Eşya Hukuku', year: 3 },
  { id: 'ticaret-hukuku', name: 'Ticaret Hukuku', year: 3 },
  { id: 'vergi-hukuku', name: 'Vergi Hukuku', year: 3 },
  { id: 'idari-yargilama', name: 'İdari Yargılama Hukuku', year: 3 },
  
  // 4. Sınıf
  { id: 'ceza-muhakemesi', name: 'Ceza Muhakemesi Hukuku', year: 4 },
  { id: 'icra-iflas', name: 'İcra ve İflas Hukuku', year: 4 },
  { id: 'uluslararasi-ozel', name: 'Uluslararası Özel Hukuk', year: 4 },
  { id: 'is-sosyal-guvenlik', name: 'İş ve Sosyal Güvenlik Hukuku', year: 4 },
  { id: 'kiymetli-evrak', name: 'Kıymetli Evrak Hukuku', year: 4 },
  { id: 'adli-tip', name: 'Adli Tıp', year: 4 }
];

export function initDb() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Courses store
      if (!db.objectStoreNames.contains('courses')) {
        db.createObjectStore('courses', { keyPath: 'id' });
      }

      // Notes store
      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('courseId', 'courseId', { unique: false });
      }

      // PDFs store
      if (!db.objectStoreNames.contains('pdfs')) {
        const pdfsStore = db.createObjectStore('pdfs', { keyPath: 'id' });
        pdfsStore.createIndex('courseId', 'courseId', { unique: false });
      }

      // Quizzes store (history of solved tests)
      if (!db.objectStoreNames.contains('quizzes')) {
        const quizzesStore = db.createObjectStore('quizzes', { keyPath: 'id' });
        quizzesStore.createIndex('courseId', 'courseId', { unique: false });
      }

      // Populate default courses
      const transaction = event.target.transaction;
      const coursesStore = transaction.objectStore( 'courses');
      DEFAULT_COURSES.forEach(course => {
        coursesStore.put(course);
      });
    };
  });
}

// --- Courses Operations ---
export async function getCourses() {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('courses', 'readonly');
    const store = transaction.objectStore('courses');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addCourse(course) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('courses', 'readwrite');
    const store = transaction.objectStore('courses');
    const request = store.put(course); // put acts as insert/update
    
    request.onsuccess = () => resolve(course);
    request.onerror = () => reject(request.error);
  });
}

// --- Notes Operations ---
export async function getNotes(courseId) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notes', 'readonly');
    const store = transaction.objectStore('notes');
    const index = store.index('courseId');
    const request = index.getAll(IDBKeyRange.only(courseId));
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getNote(id) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notes', 'readonly');
    const store = transaction.objectStore('notes');
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveNote(note) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notes', 'readwrite');
    const store = transaction.objectStore('notes');
    const request = store.put(note);
    
    request.onsuccess = () => resolve(note);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteNote(id) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notes', 'readwrite');
    const store = transaction.objectStore('notes');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

// --- PDFs Operations ---
export async function getPdfs(courseId) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pdfs', 'readonly');
    const store = transaction.objectStore('pdfs');
    const index = store.index('courseId');
    const request = index.getAll(IDBKeyRange.only(courseId));
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPdf(id) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pdfs', 'readonly');
    const store = transaction.objectStore('pdfs');
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePdf(pdf) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pdfs', 'readwrite');
    const store = transaction.objectStore('pdfs');
    const request = store.put(pdf);
    
    request.onsuccess = () => resolve(pdf);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePdf(id) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pdfs', 'readwrite');
    const store = transaction.objectStore('pdfs');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

// --- Quizzes Operations ---
export async function getQuizzes(courseId) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('quizzes', 'readonly');
    const store = transaction.objectStore('quizzes');
    const index = store.index('courseId');
    const request = index.getAll(IDBKeyRange.only(courseId));
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllQuizzes() {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('quizzes', 'readonly');
    const store = transaction.objectStore('quizzes');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveQuiz(quiz) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('quizzes', 'readwrite');
    const store = transaction.objectStore('quizzes');
    const request = store.put(quiz);
    
    request.onsuccess = () => resolve(quiz);
    request.onerror = () => reject(request.error);
  });
}

// --- Global Stats Operation ---
export async function getGlobalStats() {
  const db = await initDb();
  
  const getCount = (storeName) => {
    return new Promise((resolve) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  };

  const getAvgQuizScore = () => {
    return new Promise((resolve) => {
      const transaction = db.transaction('quizzes', 'readonly');
      const store = transaction.objectStore('quizzes');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const quizzes = request.result;
        if (!quizzes || quizzes.length === 0) {
          resolve(0);
          return;
        }
        
        let totalScore = 0;
        let totalMax = 0;
        quizzes.forEach(q => {
          totalScore += q.score;
          totalMax += q.maxScore;
        });
        
        resolve(totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0);
      };
      request.onerror = () => resolve(0);
    });
  };

  const totalNotes = await getCount('notes');
  const totalPdfs = await getCount('pdfs');
  const avgScore = await getAvgQuizScore();

  return { totalNotes, totalPdfs, avgScore };
}

/* js/db.js */

const DB_NAME = 'cukurova_hukuk_db';
const DB_VERSION = 3;

let dbInstance = null;

const CURRICULUM_TEMPLATES = {
  'hukuk': [
    { id: 'hukuk-baslangici', name: 'Hukuk Başlangıcı', year: 1 },
    { id: 'anayasa-hukuku-1', name: 'Anayasa Hukuku (Genel Esaslar)', year: 1 },
    { id: 'medeni-hukuk-1', name: 'Medeni Hukuk (Giriş - Kişiler - Aile)', year: 1 },
    { id: 'roma-hukuku', name: 'Roma Hukuku', year: 1 },
    { id: 'hukuk-tarihi', name: 'Hukuk Tarihi', year: 1 },
    { id: 'hukuk-sosyolojisi', name: 'Hukuk Sosyolojisi', year: 1 },
    { id: 'borclar-genel', name: 'Borçlar Hukuku Genel Hükümler', year: 2 },
    { id: 'ceza-genel', name: 'Ceza Hukuku Genel Hükümler', year: 2 },
    { id: 'idare-hukuku', name: 'İdare Hukuku', year: 2 },
    { id: 'uluslararasi-kamu', name: 'Uluslararası Kamu Hukuku', year: 2 },
    { id: 'genel-kamu-teorisi', name: 'Genel Kamu Teorisi', year: 2 },
    { id: 'borclar-ozel', name: 'Borçlar Hukuku Özel Hükümler', year: 3 },
    { id: 'ceza-ozel', name: 'Ceza Hukuku Özel Hükümler', year: 3 },
    { id: 'medeni-usul', name: 'Medeni Usul Hukuku', year: 3 },
    { id: 'esya-hukuku', name: 'Eşya Hukuku', year: 3 },
    { id: 'ticaret-hukuku', name: 'Ticaret Hukuku', year: 3 },
    { id: 'vergi-hukuku', name: 'Vergi Hukuku', year: 3 },
    { id: 'idari-yargilama', name: 'İdari Yargılama Hukuku', year: 3 },
    { id: 'ceza-muhakemesi', name: 'Ceza Muhakemesi Hukuku', year: 4 },
    { id: 'icra-iflas', name: 'İcra ve İflas Hukuku', year: 4 },
    { id: 'uluslararasi-ozel', name: 'Uluslararası Özel Hukuk', year: 4 },
    { id: 'is-sosyal-guvenlik', name: 'İş ve Sosyal Güvenlik Hukuku', year: 4 },
    { id: 'kiymetli-evrak', name: 'Kıymetli Evrak Hukuku', year: 4 },
    { id: 'adli-tip', name: 'Adli Tıp', year: 4 }
  ],
  'bilgisayar-muhendisligi': [
    { id: 'programlamaya-giris', name: 'Programlamaya Giriş (Python/C)', year: 1 },
    { id: 'matematik-1', name: 'Matematik I (Kalkülüs)', year: 1 },
    { id: 'fizik-1', name: 'Fizik I', year: 1 },
    { id: 'lineer-cebir', name: 'Lineer Cebir', year: 1 },
    { id: 'matematik-2', name: 'Matematik II (Kalkülüs)', year: 1 },
    { id: 'fizik-2', name: 'Fizik II', year: 1 },
    { id: 'veri-yapilari', name: 'Veri Yapıları ve Algoritmalar', year: 2 },
    { id: 'bilgisayar-organizasyonu', name: 'Bilgisayar Organizasyonu', year: 2 },
    { id: 'nesne-yonelimli-prog', name: 'Nesne Yönelimli Programlama', year: 2 },
    { id: 'diferansiyel-denklemler', name: 'Diferansiyel Denklemler', year: 2 },
    { id: 'ayrik-matematik', name: 'Ayrık Matematik', year: 2 },
    { id: 'isletim-sistemleri', name: 'İşletim Sistemleri', year: 3 },
    { id: 'veritabani-yonetim', name: 'Veritabanı Yönetim Sistemleri', year: 3 },
    { id: 'yazilim-muhendisligi', name: 'Yazılım Mühendisliği', year: 3 },
    { id: 'algoritma-analizi', name: 'Algoritmaların Tasarımı ve Analizi', year: 3 },
    { id: 'otomata-teorisi', name: 'Otomata Teorisi ve Biçimsel Diller', year: 3 },
    { id: 'yapay-zekaya-giris', name: 'Yapay Zekaya Giriş', year: 4 },
    { id: 'bilgisayar-aglari', name: 'Bilgisayar Ağları', year: 4 },
    { id: 'bulut-bilisim', name: 'Bulut Bilişim', year: 4 },
    { id: 'sistem-programlama', name: 'Sistem Programlama', year: 4 },
    { id: 'bitirme-projesi', name: 'Bitirme Projesi', year: 4 }
  ],
  'tip': [
    { id: 'tibbi-biyoloji-genetik', name: 'Tıbbi Biyoloji ve Genetik', year: 1 },
    { id: 'anatomiye-giris', name: 'Anatomiye Giriş ve Lokomotor Sistem', year: 1 },
    { id: 'tibbi-biyokimya-1', name: 'Tıbbi Biyokimya I', year: 1 },
    { id: 'hucre-bilimi', name: 'Hücre Bilimi ve Histolojiye Giriş', year: 1 },
    { id: 'anatomi-2', name: 'Anatomi II (Sistemler)', year: 2 },
    { id: 'fizyoloji-1', name: 'Fizyoloji I', year: 2 },
    { id: 'histoloji-embriyoloji', name: 'Histoloji ve Embriyoloji II', year: 2 },
    { id: 'mikrobiyoloji-immunoloji', name: 'Mikrobiyoloji ve İmmünoloji', year: 2 },
    { id: 'patoloji-genel', name: 'Patoloji Genel Esaslar', year: 3 },
    { id: 'farmakoloji-giris', name: 'Farmakolojiye Giriş', year: 3 },
    { id: 'semiyoloji-klinik', name: 'Klinik Semiyoloji (Belirti Bilimi)', year: 3 },
    { id: 'klinik-mikrobiyoloji', name: 'Klinik Mikrobiyoloji ve Enfeksiyon', year: 3 },
    { id: 'ic-hastaliklari', name: 'İç Hastalıkları (Dahiliye) Stajı', year: 4 },
    { id: 'cocuk-sagligi', name: 'Çocuk Sağlığı ve Hastalıkları Stajı', year: 4 },
    { id: 'genel-cerrahi', name: 'Genel Cerrahi Stajı', year: 4 },
    { id: 'kadin-hastaliklari', name: 'Kadın Hastalıkları ve Doğum Stajı', year: 4 }
  ],
  'isletme': [
    { id: 'isletme-bilimine-giris', name: 'İşletme Bilimine Giriş', year: 1 },
    { id: 'mikroekonomi', name: 'Mikroekonomi', year: 1 },
    { id: 'genel-muhasebe', name: 'Genel Muhasebe', year: 1 },
    { id: 'isletme-matematigi', name: 'İşletme Matematiği', year: 1 },
    { id: 'hukukun-temel-kavramlari', name: 'Hukukun Temel Kavramları', year: 1 },
    { id: 'makroekonomi', name: 'Makroekonomi', year: 2 },
    { id: 'finansal-muhasebe', name: 'Finansal Muhasebe', year: 2 },
    { id: 'orgutsel-davranis', name: 'Örgütsel Davranış', year: 2 },
    { id: 'pazarlama-ilkeleri', name: 'Pazarlama İlkeleri', year: 2 },
    { id: 'istatistik-1', name: 'İstatistik I', year: 2 },
    { id: 'finansal-yonetim', name: 'Finansal Yönetim', year: 3 },
    { id: 'insan-kaynaklari', name: 'İnsan Kaynakları Yönetimi', year: 3 },
    { id: 'yoneylem-arastirmasi', name: 'Yöneylem Araştırması', year: 3 },
    { id: 'uretim-yonetimi', name: 'Üretim ve İşlemler Yönetimi', year: 3 },
    { id: 'isletme-hukuku', name: 'İşletme Hukuku', year: 3 },
    { id: 'stratejik-yonetim', name: 'Stratejik Yönetim', year: 4 },
    { id: 'girisimcilik', name: 'Girişimcilik', year: 4 },
    { id: 'uluslararasi-isletmecilik', name: 'Uluslararası İşletmecilik', year: 4 },
    { id: 'karar-analizi', name: 'Karar Analizi', year: 4 },
    { id: 'isletme-etigi', name: 'İşletme Etiği', year: 4 }
  ],
  'diger': [
    { id: 'akademik-yazim', name: 'Akademik Yazım ve Sunum Becerileri', year: 1 },
    { id: 'bilgi-teknolojileri', name: 'Temel Bilgi Teknolojileri', year: 1 },
    { id: 'ilgili-alana-giris-1', name: 'İlgili Alana Giriş I', year: 1 },
    { id: 'ilgili-alana-giris-2', name: 'İlgili Alana Giriş II', year: 1 },
    { id: 'ileri-duzey-calismalar-1', name: 'İleri Düzey Çalışmalar I', year: 2 },
    { id: 'ileri-duzey-calismalar-2', name: 'İleri Düzey Çalışmalar II', year: 2 },
    { id: 'arastirma-yontemleri', name: 'Araştırma Yöntemleri', year: 2 },
    { id: 'mesleki-etik', name: 'Mesleki Etik ve Sorumluluk', year: 2 },
    { id: 'alan-secmeli-1', name: 'Alan Seçmeli Dersi I', year: 3 },
    { id: 'alan-secmeli-2', name: 'Alan Seçmeli Dersi II', year: 3 },
    { id: 'proje-yonetimi', name: 'Proje Yönetimi', year: 3 },
    { id: 'staj-uygulama', name: 'Staj ve Saha Uygulaması', year: 3 },
    { id: 'bitirme-projesi', name: 'Bitirme Projesi / Tezi', year: 4 },
    { id: 'sektorel-analiz', name: 'Sektörel Analiz ve Raporlama', year: 4 },
    { id: 'alan-secmeli-3', name: 'Alan Seçmeli Dersi III', year: 4 },
    { id: 'alan-secmeli-4', name: 'Alan Seçmeli Dersi IV', year: 4 }
  ]
};

const MOCK_COMMUNITY_ITEMS = [
  {
    id: 'comm-1',
    title: 'Anayasa Mahkemesi Karar İncelemeleri Özet Dökümanı',
    type: 'pdf',
    university: 'Ankara Üniversitesi',
    department: 'Hukuk',
    courseName: 'Anayasa Hukuku',
    size: 24576,
    textContent: '[Sayfa 1]\nAnayasa Mahkemesi’nin bireysel başvuru kararlarında mülkiyet hakkı koruması ve idarenin takdir yetkisi sınırları...',
    uploaderName: 'Ahmet Yılmaz',
    downloads: 42,
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000
  },
  {
    id: 'comm-2',
    title: 'Veri Yapıları - Ağaçlar ve Graf Algoritmaları Çalışma Notu',
    type: 'note',
    university: 'Orta Doğu Teknik Üniversitesi',
    department: 'Bilgisayar Mühendisliği',
    courseName: 'Veri Yapıları ve Algoritmalar',
    size: 5120,
    textContent: 'Binary Search Tree (BST), AVL Ağaçları ve Kırmızı-Siyah Ağaçlar üzerine detaylı çalışma özeti...\nKruskal ve Prim algoritmaları çalışma süreleri kıyaslaması...',
    uploaderName: 'Selin Kaya',
    downloads: 87,
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000
  },
  {
    id: 'comm-3',
    title: 'Anatomi Lokomotor Sistem Çıkmış Sınav Soruları',
    type: 'quiz',
    university: 'Hacettepe Üniversitesi',
    department: 'Tıp',
    courseName: 'Anatomiye Giriş ve Lokomotor Sistem',
    size: 0,
    textContent: JSON.stringify([
      {
        question: "Aşağıdeki kemiklerden hangisi neurocranium (beyin kafatası) kemiklerindendir?",
        options: ["Os sphenoidale", "Os zygomaticum", "Os lacrimale", "Os nasale", "Maxilla"],
        answerIndex: 0,
        explanation: "Os sphenoidale (temel kemik) neurocranium'a aittir, diğerleri viscerocranium (yüz kafatası) kemikleridir."
      },
      {
        question: "Articulatio humeri (omuz eklemi) ne tip bir eklemdir?",
        options: ["Sellar", "Trochoid", "Ginglymus", "Spheroid", "Condylar"],
        answerIndex: 3,
        explanation: "Articulatio humeri, spheroidea (art. spheroidea - küresel) tipte çok eksenli bir eklemdir."
      }
    ]),
    uploaderName: 'Dr. Burak Çetin',
    downloads: 135,
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000
  },
  {
    id: 'comm-4',
    title: 'Mikroekonomi - Tüketici Dengesi ve Esneklik Çözümlü Test',
    type: 'quiz',
    university: 'İstanbul Üniversitesi',
    department: 'İşletme',
    courseName: 'Mikroekonomi',
    size: 0,
    textContent: JSON.stringify([
      {
        question: "Bir malın fiyatı arttığında, ikame malın talebi nasıl değişir?",
        options: ["Azalır", "Değişmez", "Artar", "Önce azalır sonra artar"],
        answerIndex: 2,
        explanation: "İkame mallarda, birinin fiyatı artarsa tüketiciler diğer mala yönelir, bu yüzden ikame malın talebi artar."
      }
    ]),
    uploaderName: 'Merve Demir',
    downloads: 64,
    createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000
  }
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

      // Quizzes store
      if (!db.objectStoreNames.contains('quizzes')) {
        const quizzesStore = db.createObjectStore('quizzes', { keyPath: 'id' });
        quizzesStore.createIndex('courseId', 'courseId', { unique: false });
      }

      // Saved Quiz Banks store
      if (!db.objectStoreNames.contains('savedQuizBanks')) {
        const banksStore = db.createObjectStore('savedQuizBanks', { keyPath: 'id' });
        banksStore.createIndex('courseId', 'courseId', { unique: false });
      }

      // Community Items store
      if (!db.objectStoreNames.contains('communityItems')) {
        const communityStore = db.createObjectStore('communityItems', { keyPath: 'id' });
        communityStore.createIndex('university', 'university', { unique: false });
        communityStore.createIndex('department', 'department', { unique: false });
        communityStore.createIndex('type', 'type', { unique: false });
      }
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
    const request = store.put(course);
    
    request.onsuccess = () => resolve(course);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCourse(id) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['courses', 'notes', 'pdfs', 'quizzes', 'savedQuizBanks'], 'readwrite');
    
    transaction.objectStore('courses').delete(id);
    
    const deleteFromStoreByIndex = (storeName, indexName, value) => {
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.openCursor(IDBKeyRange.only(value));
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    };

    deleteFromStoreByIndex('notes', 'courseId', id);
    deleteFromStoreByIndex('pdfs', 'courseId', id);
    deleteFromStoreByIndex('quizzes', 'courseId', id);
    deleteFromStoreByIndex('savedQuizBanks', 'courseId', id);

    transaction.oncomplete = () => resolve(id);
    transaction.onerror = () => reject(transaction.error);
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

// --- Saved Quiz Banks Operations ---
export async function getQuizBanks(courseId) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('savedQuizBanks', 'readonly');
    const store = transaction.objectStore('savedQuizBanks');
    const index = store.index('courseId');
    const request = index.getAll(IDBKeyRange.only(courseId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveQuizBank(bank) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('savedQuizBanks', 'readwrite');
    const store = transaction.objectStore('savedQuizBanks');
    const request = store.put(bank);
    request.onsuccess = () => resolve(bank);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteQuizBank(id) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('savedQuizBanks', 'readwrite');
    const store = transaction.objectStore('savedQuizBanks');
    const request = store.delete(id);
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

// --- Dynamic Curriculum Setup ---
export async function setupCurriculum(university, department) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['courses', 'notes', 'pdfs', 'quizzes', 'savedQuizBanks'], 'readwrite');
    
    transaction.objectStore('courses').clear();
    transaction.objectStore('notes').clear();
    transaction.objectStore('pdfs').clear();
    transaction.objectStore('quizzes').clear();
    transaction.objectStore('savedQuizBanks').clear();

    const coursesStore = transaction.objectStore('courses');
    const templateKey = CURRICULUM_TEMPLATES[department] ? department : 'diger';
    const coursesToLoad = CURRICULUM_TEMPLATES[templateKey];

    coursesToLoad.forEach(course => {
      coursesStore.put(course);
    });

    transaction.oncomplete = () => {
      localStorage.setItem('selected_university', university);
      localStorage.setItem('selected_department', department);
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

// --- Community Operations ---
export async function getCommunityItems() {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('communityItems', 'readonly');
    const store = transaction.objectStore('communityItems');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addCommunityItem(item) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('communityItems', 'readwrite');
    const store = transaction.objectStore('communityItems');
    const request = store.put(item);
    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCommunityItem(id) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('communityItems', 'readwrite');
    const store = transaction.objectStore('communityItems');
    const request = store.delete(id);
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

export async function seedCommunityItems() {
  const db = await initDb();
  const items = await getCommunityItems();
  if (items.length > 0) return; // already seeded

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('communityItems', 'readwrite');
    const store = transaction.objectStore('communityItems');
    MOCK_COMMUNITY_ITEMS.forEach(item => {
      store.put(item);
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
